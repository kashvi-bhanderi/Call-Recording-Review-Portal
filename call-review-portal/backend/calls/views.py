from subprocess import call
from urllib import request

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from rest_framework.generics import ListAPIView
from django_filters.rest_framework import DjangoFilterBackend
from .models import Call, CallCH, Tag, EvaluationMetric, EvaluationCallRating
from accounts.models import Language, User, Organization
from .serializers import DashboardCallSerializer, EvaluationCallRatingSerializer
from .filters import DashboardCallFilter
from accounts.authentication import CookieJWTAuthentication
from rest_framework.exceptions import ValidationError as DRFValidationError
from .models import EntityDefinition
from .entity_operators import OPERATOR_CONFIG
from .services import (
    acquire_lock,
    release_lock,
    check_lock_expiry,
    LOCK_DURATION,
)
from rest_framework import status
from .s3_service import find_audio_file, generate_signed_url
from django.conf import settings
import json, ast
import re

from datetime import datetime, date, time


def normalize_bool(value):
    """
    Convert common truthy/falsey values into Python bool.
    """
    if isinstance(value, bool):
        return value

    if value is None:
        raise ValueError("Boolean value cannot be None")

    val = str(value).strip().lower()

    if val in ["true", "1", "yes", "y"]:
        return True
    if val in ["false", "0", "no", "n"]:
        return False

    raise ValueError(f"Invalid boolean value: {value}")


def parse_value_by_type(value, data_type):
    """
    Convert raw entity/filter value to proper Python type
    based on EntityDefinition.data_type.
    Supported types:
    string, number, date, datetime, time, boolean
    """
    if value is None:
        return None

    if data_type == "string":
        return str(value)

    if data_type == "number":
        return float(value)

    if data_type == "boolean":
        return normalize_bool(value)

    if data_type == "date":
        # Expected format: YYYY-MM-DD
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        return datetime.strptime(str(value), "%Y-%m-%d").date()

    if data_type == "datetime":
        # Supports ISO format: YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS
        val = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(val)

    if data_type == "time":
        # Expected format: HH:MM[:SS]
        val = str(value)
        try:
            return datetime.strptime(val, "%H:%M:%S").time()
        except ValueError:
            return datetime.strptime(val, "%H:%M").time()

    # Fallback
    return str(value)


def apply_operator(call_val, filter_val, operator, data_type):
    """
    Apply operator based on datatype.
    """
    # Normalize strings for case-insensitive comparisons where applicable
    if data_type == "string":
        call_str = str(call_val)
        filter_str = str(filter_val)

        if operator == "eq":
            return call_str.lower() == filter_str.lower()
        elif operator == "contains":
            return filter_str.lower() in call_str.lower()
        elif operator == "startswith":
            return call_str.lower().startswith(filter_str.lower())
        return False

    if data_type in ["number", "date", "datetime", "time"]:
        if operator == "eq":
            return call_val == filter_val
        elif operator == "gt":
            return call_val > filter_val
        elif operator == "lt":
            return call_val < filter_val
        return False

    if data_type == "boolean":
        if operator == "eq":
            return call_val == filter_val
        return False

    # Fallback generic
    if operator == "eq":
        return str(call_val) == str(filter_val)

    return False

def parse_entities(raw_entities):
    """
    Parse ClickHouse entities stored like:
    "key"=>"value", "key2"=>"value2"
    into Python dict.
    """
    if not raw_entities or raw_entities == "None":
        return {}

    if isinstance(raw_entities, dict):
        return raw_entities

    if isinstance(raw_entities, str):
        pairs = re.findall(r'"(.*?)"\s*=>\s*"(.*?)"', raw_entities)
        return {k: v for k, v in pairs}

    return {}


# ------------------------
# CONSULTANT SUBMIT
# ------------------------
class SubmitCallReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def post(self, request):
        call_uuid = request.data.get("call_uuid")
        call = Call.objects.filter(uuid=call_uuid).first()

        if call:
            check_lock_expiry(call)

            if call.rated_by_id and call.rated_by_id != request.user.id:
                return Response(
                    {"error": "Another consultant already rated this call"},
                    status=403
                )

            if call.status in [3, 4]:
                return Response(
                    {"error": "Lead already reviewed this call"},
                    status=403
                )

            if call.rating_locked:
                return Response(
                    {"error": "Lead is reviewing this call"},
                    status=403
                )

        serializer = EvaluationCallRatingSerializer(data=request.data)

        if serializer.is_valid():
            try:
                call = serializer.create_or_update_ratings(user=request.user)
            except DRFValidationError as e:
                return Response(
                    {
                        "error": str(e.detail[0]) if isinstance(e.detail, list) else str(e.detail)
                    },
                    status=403
                )

            return Response({
                "message": "Review submitted successfully",
                "call_uuid": call.uuid,
                "status": call.get_status_display()
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ------------------------
# DASHBOARD LIST
# ------------------------
class DashboardCallView(ListAPIView):
    serializer_class = DashboardCallSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]
    filter_backends = [DjangoFilterBackend]
    filterset_class = DashboardCallFilter

    def get_queryset(self):
        user = self.request.user
        queryset = CallCH.objects.using("clickhouse").all()

        # ------------------------
        # LANGUAGE ACCESS FILTER
        # ------------------------
        if not user.is_superuser:
            allowed_languages = list(
                user.accessible_languages.values_list("language", flat=True)
            )
            if not allowed_languages:
                return queryset.none()
            queryset = queryset.filter(language__in=allowed_languages)

        # ------------------------
        # ORGANIZATION ACCESS FILTER
        # ------------------------
        if not user.is_superuser:
            allowed_schemas = list(
                user.accessible_organizations.values_list("schema_name", flat=True)
            )
            if allowed_schemas:
                queryset = queryset.filter(schema_name__in=allowed_schemas)
            else:
                return queryset.none()

        status_filter = self.request.GET.get("status")
        rated_by = self.request.GET.get("rated_by")
        tags = self.request.GET.get("tags")
        entity_filters_raw = self.request.GET.get("entity_filters")

        if status_filter:
            status_values = [int(s) for s in status_filter.split(",") if s.strip().isdigit()]

            if not status_values:
                return queryset.none()

            matched_uuids = set(
                Call.objects.filter(status__in=status_values).values_list("uuid", flat=True)
            )

            # Special handling for Not Rated (1)
            # Include CH calls with no PG row
            if 1 in status_values:
                visible_ch_uuids = set(queryset.values_list("uuid", flat=True))
                existing_pg_uuids = set(
                    Call.objects.filter(uuid__in=visible_ch_uuids).values_list("uuid", flat=True)
                )
                matched_uuids.update(visible_ch_uuids - existing_pg_uuids)

            queryset = queryset.filter(uuid__in=list(matched_uuids))

        if rated_by:
            uuids = Call.objects.filter(
                rated_by_id=rated_by
            ).values_list("uuid", flat=True)
            queryset = queryset.filter(uuid__in=list(uuids))

        if tags:
            uuids = Call.objects.filter(
                tags__id__in=tags.split(",")
            ).values_list("uuid", flat=True)
            queryset = queryset.filter(uuid__in=list(uuids))

        # ------------------------
        # ENTITY FILTERS (MULTI KEY + MULTI VALUE)
        # Logic:
        # - Same key: OR among selected values
        # - Across keys: AND
        # ------------------------
        if entity_filters_raw:
            try:
                entity_filters = json.loads(entity_filters_raw)
            except (json.JSONDecodeError, TypeError):
                entity_filters = []

            # Cache entity definitions once
            entity_keys = [f.get("key") for f in entity_filters if f.get("key")]
            entity_defs = {
                e.key: e.data_type
                for e in EntityDefinition.objects.filter(key__in=entity_keys)
            }

            matched_uuids = []

            for call in queryset:
                entities = parse_entities(call.entities)
                is_match = True

                for f in entity_filters:
                    key = f.get("key")
                    operator = f.get("operator")
                    value = f.get("value")

                    if not key or not operator:
                        is_match = False
                        break

                    if key not in entities:
                        is_match = False
                        break

                    raw_call_val = entities.get(key)

                    # Default to string if no definition found
                    data_type = entity_defs.get(key, "string")

                    # Validate operator is allowed for datatype
                    allowed_ops = [op["value"] for op in OPERATOR_CONFIG.get(data_type, [])]
                    if operator not in allowed_ops:
                        is_match = False
                        break

                    try:
                        call_val = parse_value_by_type(raw_call_val, data_type)
                        filter_val = parse_value_by_type(value, data_type)

                        if not apply_operator(call_val, filter_val, operator, data_type):
                            is_match = False
                            break

                    except Exception:
                        is_match = False
                        break

                if is_match:
                    matched_uuids.append(call.uuid)

            queryset = queryset.filter(uuid__in=matched_uuids)
        # ------------------------
        # MANUAL SORTING (CLICKHOUSE SAFE)
        # ------------------------
        ordering = self.request.GET.get("ordering", "-attempt_on_time_stamp")

        allowed_orderings = [
            "duration",
            "-duration",
            "attempt_on_time_stamp",
            "-attempt_on_time_stamp",
        ]

        if ordering not in allowed_orderings:
            ordering = "-attempt_on_time_stamp"

        queryset = queryset.order_by(ordering)

        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()

        queryset = self.get_queryset()
        call_uuids = [obj.uuid for obj in queryset]

        calls_map = {
            c.uuid: c
            for c in Call.objects.filter(uuid__in=call_uuids)
            .prefetch_related("tags", "evaluationcallrating_set")
        }

        user_ids = [c.rated_by_id for c in calls_map.values() if c.rated_by_id]
        users_map = {u.id: u for u in User.objects.filter(id__in=user_ids)}

        context["calls_map"] = calls_map
        context["users_map"] = users_map

        return context


class CallFilterOptionsView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get(self, request):
        user = request.user

        # --------------------
        # BASE CLICKHOUSE QUERYSET (SAME ACCESS AS DASHBOARD)
        # --------------------
        ch_queryset = CallCH.objects.using("clickhouse").all()

        if not user.is_superuser:
            allowed_languages = list(
                user.accessible_languages.values_list("language", flat=True)
            )

            if not allowed_languages:
                return Response({
                    "languages": [],
                    "schemas": [],
                    "statuses": [
                        {"value": 1, "label": "Not Rated"},
                        {"value": 2, "label": "Rated"},
                        {"value": 3, "label": "Production Issue"},
                        {"value": 4, "label": "Approved"},
                    ],
                    "rated_by": [],
                    "tags": [],
                })

            ch_queryset = ch_queryset.filter(language__in=allowed_languages)

        # --------------------
        # ORGANIZATION ACCESS FILTER (SAME AS DASHBOARD)
        # --------------------
        if not user.is_superuser:
            allowed_schemas = list(
                user.accessible_organizations.values_list("schema_name", flat=True)
            )

            if not allowed_schemas:
                return Response({
                    "languages": [],
                    "schemas": [],
                    "statuses": [
                        {"value": 1, "label": "Not Rated"},
                        {"value": 2, "label": "Rated"},
                        {"value": 3, "label": "Production Issue"},
                        {"value": 4, "label": "Approved"},
                    ],
                    "rated_by": [],
                    "tags": [],
                })

            ch_queryset = ch_queryset.filter(schema_name__in=allowed_schemas)

        # --------------------
        # LANGUAGE OPTIONS (ONLY ACCESSIBLE)
        # --------------------
        codes = list(
            ch_queryset.values_list("language", flat=True).distinct()
        )

        languages = Language.objects.filter(
            language__in=codes
        ).values("language", "language_name")

        # --------------------
        # ORGANIZATION OPTIONS (ONLY ACCESSIBLE)
        # --------------------
        schema_codes = list(
            ch_queryset.exclude(schema_name__isnull=True)
            .exclude(schema_name__exact="")
            .values_list("schema_name", flat=True)
            .distinct()
        )

        schemas = Organization.objects.filter(
            schema_name__in=schema_codes,
            is_active=True
        ).values("schema_name", "org_name")

        # --------------------
        # STATUS OPTIONS
        # --------------------
        statuses = [
            {"value": 1, "label": "Not Rated"},
            {"value": 2, "label": "Rated"},
            {"value": 3, "label": "Production Issue"},
            {"value": 4, "label": "Approved"},
        ]

        # --------------------
        # ONLY CALL UUIDs USER CAN SEE
        # --------------------
        visible_uuids = list(
            ch_queryset.values_list("uuid", flat=True)
        )

        # --------------------
        # RATED BY (ONLY FROM VISIBLE CALLS)
        # --------------------
        rated_by = (
            User.objects.filter(
                consultant_rated_calls__uuid__in=visible_uuids
            )
            .distinct()
            .values("id", "username")
        )

        # --------------------
        # TAGS (ONLY FROM VISIBLE CALLS)
        # --------------------
        tag_ids = (
            Call.objects.filter(uuid__in=visible_uuids, tags__isnull=False)
            .values_list("tags__id", flat=True)
            .distinct()
        )

        tags = Tag.objects.filter(id__in=tag_ids).values("id", "name")

        return Response({
            "languages": list(languages),
            "schemas": list(schemas),
            "statuses": statuses,
            "rated_by": list(rated_by),
            "tags": list(tags),
        })


# ------------------------
# CONSULTANT CALL DETAIL
# ------------------------
class ConsultantCallDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, call_uuid):
        try:
            ch_call = CallCH.objects.using("clickhouse").get(uuid=call_uuid)
        except CallCH.DoesNotExist:
            return Response({"error": "Call not found"}, status=404)

        call, created = Call.objects.get_or_create(
            uuid=call_uuid,
            defaults={"attempt_on_time_stamp": ch_call.attempt_on_time_stamp}
        )

        check_lock_expiry(call)

        is_locked = False
        lock_reason = None

        # Case 1: Another consultant already rated this call
        # This must take highest priority for non-owner consultants
        if call.rated_by_id and call.rated_by_id != request.user.id:
            is_locked = True
            lock_reason = "consultant_taken"

        # Case 2: Same consultant who rated the call
        else:
            # Lead already finalized review
            if call.status in [3, 4]:
                is_locked = True
                lock_reason = "permanent"

            # Lead is currently reviewing (temporary lock)
            elif call.rating_locked:
                is_locked = True
                lock_reason = "temporary"

        metrics = EvaluationMetric.objects.filter(is_active=True)

        # Consultant's own ratings (always shown)
        # consultant_ratings = EvaluationCallRating.objects.filter(
        #     call=call,
        #     rated_by=request.user
        # )
        # Show ratings of the consultant who owns this call review
        consultant_ratings_map = {}

        if call.rated_by_id:
            owner_ratings = EvaluationCallRating.objects.filter(
                call=call,
                rated_by_id=call.rated_by_id
            )
            consultant_ratings_map = {r.parameter.name: r.rating for r in owner_ratings}
        else:
            own_ratings = EvaluationCallRating.objects.filter(
                call=call,
                rated_by=request.user
            )
            consultant_ratings_map = {r.parameter.name: r.rating for r in own_ratings}

        # Lead ratings (shown only after lead submits)
        lead_ratings_map = {}
        lead_comment = ""

        if call.status in [3, 4] and call.reviewed_by_id:
            lead_ratings = EvaluationCallRating.objects.filter(
                call=call,
                rated_by_id=call.reviewed_by_id
            )
            lead_ratings_map = {r.parameter.name: r.rating for r in lead_ratings}
            lead_comment = call.lead_comment or ""

        lang_obj = Language.objects.filter(language=ch_call.language).first()
        language_name = lang_obj.language_name if lang_obj else ch_call.language

        org_obj = Organization.objects.filter(
            schema_name=ch_call.schema_name,
            is_active=True
        ).first()
        org_name = org_obj.org_name if org_obj else ch_call.schema_name

        data = {
            "metadata": {
                "schema_name": ch_call.schema_name,
                "org_name": org_name,
                "language": language_name,
                "uuid": ch_call.uuid,
                "phone_number": ch_call.phone_number,
                "duration": ch_call.duration,
                "attempt_on_time_stamp": ch_call.attempt_on_time_stamp,
                "status": call.get_status_display(),
                "rated_by": call.rated_by.username if call.rated_by else None,
                "entities": ch_call.entities or {},
            },
            "metrics": [
                {
                    "name": m.name,
                    "min": m.min_value,
                    "max": m.max_value,
                    "value": consultant_ratings_map.get(m.name)
                }
                for m in metrics
            ],
            "lead_metrics": [
                {
                    "name": m.name,
                    "min": m.min_value,
                    "max": m.max_value,
                    "value": lead_ratings_map.get(m.name)
                }
                for m in metrics
            ] if call.status in [3, 4] and call.reviewed_by_id else [],
            "comments": call.consultant_comment or "",
            "lead_comment": lead_comment,
            "is_locked": is_locked,
            "lock_reason": lock_reason
        }

        return Response(data)


# ------------------------
# LEAD CALL DETAIL
# ------------------------
class LeadCallDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, call_uuid):
        # ------------------------
        # GET CLICKHOUSE CALL
        # ------------------------
        try:
            ch_call = CallCH.objects.using("clickhouse").get(uuid=call_uuid)
        except CallCH.DoesNotExist:
            return Response({"error": "Call not found"}, status=404)

        # ------------------------
        # GET OR CREATE POSTGRES CALL
        # ------------------------
        call, created = Call.objects.get_or_create(
            uuid=call_uuid,
            defaults={"attempt_on_time_stamp": ch_call.attempt_on_time_stamp}
        )

        # ------------------------
        # CHECK LOCK EXPIRY
        # ------------------------
        check_lock_expiry(call)
        locked_by_other_lead = False

        # If another lead owns/finalized this call
        if call.reviewed_by_id and call.reviewed_by_id != request.user.id:
            locked_by_other_lead = True

        # If temporarily locked by another lead
        elif call.rating_locked and call.reviewed_by_id and call.reviewed_by_id != request.user.id:
            locked_by_other_lead = True

        # ------------------------
        # ACQUIRE LOCK FOR LEAD
        # ------------------------
        if not locked_by_other_lead and call.status not in [3, 4]:
            try:
                acquire_lock(call, request.user)
            except Exception:
                pass

        # ------------------------
        # METRICS
        # ------------------------
        metrics = EvaluationMetric.objects.filter(is_active=True)

        # ------------------------
        # CONSULTANT RATINGS
        # ------------------------
        consultant_ratings = []

        if call.rated_by:
            consultant_ratings = EvaluationCallRating.objects.filter(
                call=call,
                rated_by=call.rated_by
            )

        consultant_list = []
        for r in consultant_ratings:
            consultant_list.append({
                "metric": r.parameter.name,
                "value": r.rating,
                "min": r.parameter.min_value,
                "max": r.parameter.max_value,
            })

        # ------------------------
        # LEAD RATINGS
        # ------------------------
        # If already reviewed, show ratings of the lead who reviewed it
        # Otherwise show current user's in-progress ratings (if any)
        rating_user = call.reviewed_by if call.reviewed_by else request.user

        lead_ratings = EvaluationCallRating.objects.filter(
            call=call,
            rated_by=rating_user
        )

        lead_map = {r.parameter.name: r.rating for r in lead_ratings}

        # ------------------------
        # LANGUAGE
        # ------------------------
        lang_obj = Language.objects.filter(language=ch_call.language).first()
        language_name = lang_obj.language_name if lang_obj else ch_call.language

        # ------------------------
        # TAGS
        # ------------------------
        tags = Tag.objects.all()

        org_obj = Organization.objects.filter(
            schema_name=ch_call.schema_name,
            is_active=True
        ).first()
        org_name = org_obj.org_name if org_obj else ch_call.schema_name

        data = {
            "metadata": {
                "uuid": ch_call.uuid,
                "schema_name": ch_call.schema_name,
                "org_name": org_name,
                "phone_number": ch_call.phone_number,
                "duration": ch_call.duration,
                "language": language_name,
                "attempt_on_time_stamp": ch_call.attempt_on_time_stamp,
                "status": call.get_status_display(),
                "is_locked": locked_by_other_lead,
                "entities": ch_call.entities or {},
                "lock_message": (
                    "Another lead already reviewed this call"
                    if call.reviewed_by_id and call.reviewed_by_id != request.user.id and call.status in [3, 4]
                    else "Another lead is currently reviewing this call"
                    if call.rating_locked and call.reviewed_by_id and call.reviewed_by_id != request.user.id
                    else ""
                ),
                "reviewed_by": call.reviewed_by.username if call.reviewed_by else None,
            },
            "consultant_review": {
                "ratings": consultant_list,
                "comment": call.consultant_comment,
                "timestamp": call.rated_at
            },
            "metrics": [
                {
                    "name": m.name,
                    "min": m.min_value,
                    "max": m.max_value,
                    "value": lead_map.get(m.name)
                }
                for m in metrics
            ],
            "lead_comment": call.lead_comment,
            "status": call.status,
            "tag_options": [
                {"id": t.id, "name": t.name} for t in tags
            ],
            "selected_tags": [t.id for t in call.tags.all()]
        }

        return Response(data)


# ------------------------
# LEAD SUBMIT
# ------------------------
class LeadSubmitReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def post(self, request):
        call_uuid = request.data.get("call_uuid")
        ratings = request.data.get("ratings", {})
        comment = request.data.get("comment")
        tags = request.data.get("tags", [])
        new_status = request.data.get("status")

        try:
            new_status = int(new_status)
        except (TypeError, ValueError):
            return Response({"error": "Valid status is required"}, status=400)

        if new_status not in [3, 4]:
            return Response(
                {"error": "Please select the status"},
                status=400
            )

        try:
            with transaction.atomic():
                call = Call.objects.select_for_update().get(uuid=call_uuid)

                check_lock_expiry(call)

                # Another lead already owns this review -> block
                if call.reviewed_by_id and call.reviewed_by_id != request.user.id:
                    return Response(
                        {"error": "Another lead already reviewed this call"},
                        status=403
                    )

                # If call is locked by another lead temporarily -> block
                if call.rating_locked and call.reviewed_by_id and call.reviewed_by_id != request.user.id:
                    return Response(
                        {"error": "Another lead is currently reviewing this call"},
                        status=403
                    )

                # Save/update ratings for THIS lead only
                for metric_name, rating in ratings.items():
                    if rating in [None, ""]:
                        continue

                    metric = EvaluationMetric.objects.get(name=metric_name)

                    EvaluationCallRating.objects.update_or_create(
                        call=call,
                        parameter=metric,
                        rated_by=request.user,
                        defaults={"rating": rating}
                    )

                # Save/update lead review (same lead can edit)
                call.status = new_status
                call.lead_comment = comment
                call.reviewed_by = request.user
                call.reviewed_at = timezone.now()
                call.tags.set(tags)
                call.save()

                # release temporary lock after save
                release_lock(call)

                return Response({"message": "Lead review submitted successfully"})

        except Call.DoesNotExist:
            return Response({"error": "Call not found"}, status=404)


# ------------------------
# AUDIO API
# ------------------------
class CallAudioAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, call_uuid):
        # 1. Fetch call metadata from ClickHouse
        try:
            ch_call = CallCH.objects.using("clickhouse").get(uuid=call_uuid)
        except CallCH.DoesNotExist:
            return Response({"error": "Call not found"}, status=404)

        # 2. Extract tenant + date
        tenant_id = ch_call.schema_name
        ts = ch_call.attempt_on_time_stamp

        year = ts.strftime("%Y")
        month = ts.strftime("%m")
        day = ts.strftime("%d")

        # 3. Build S3 folder prefix
        prefix = f"media/{tenant_id}/freeswitch/{year}/{month}/{day}/{call_uuid}/"

        # 4. Find actual .wav file inside folder
        audio_key = find_audio_file(settings.AWS_STORAGE_BUCKET_NAME, prefix)

        if not audio_key:
            return Response(
                {
                    "error": "Audio file not found",
                    "searched_prefix": prefix
                },
                status=404
            )

        # 5. Generate signed URL
        signed_url = generate_signed_url(
            settings.AWS_STORAGE_BUCKET_NAME,
            audio_key,
            expires_in=300
        )

        # 6. OPTIONAL: log access event
        print(f"[AUDIO_ACCESS] user={request.user.id} uuid={call_uuid} key={audio_key}")

        return Response({
            "audio_url": signed_url,
            "audio_key": audio_key,   # useful for testing, remove later in production
            "expires_in": 300
        })


# ------------------------
# SELECTABLE ORGANIZATIONS
# ------------------------
class SelectableOrganizationsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get(self, request):
        user = request.user

        ch_queryset = CallCH.objects.using("clickhouse").all()

        # Superuser: show all active orgs that have calls
        if user.is_superuser:
            schema_names = list(
                ch_queryset.exclude(schema_name__isnull=True)
                .exclude(schema_name__exact="")
                .values_list("schema_name", flat=True)
                .distinct()
            )

            organizations = Organization.objects.filter(
                schema_name__in=schema_names,
                is_active=True
            ).values("schema_name", "org_name")

            return Response({
                "organizations": list(organizations)
            })

        # Accessible languages
        allowed_languages = list(
            user.accessible_languages.values_list("language", flat=True)
        )
        if not allowed_languages:
            return Response({"organizations": []})

        # Accessible orgs
        allowed_schemas = list(
            user.accessible_organizations.values_list("schema_name", flat=True)
        )
        if not allowed_schemas:
            return Response({"organizations": []})

        # Only orgs with visible calls
        visible_schema_names = list(
            ch_queryset.filter(
                schema_name__in=allowed_schemas,
                language__in=allowed_languages
            )
            .exclude(schema_name__isnull=True)
            .exclude(schema_name__exact="")
            .values_list("schema_name", flat=True)
            .distinct()
        )

        organizations = Organization.objects.filter(
            schema_name__in=visible_schema_names,
            is_active=True
        ).values("schema_name", "org_name")

        return Response({
            "organizations": list(organizations)
        })


# ------------------------
# SELECTABLE TEMPLATES
# ------------------------
class SelectableTemplatesAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get(self, request):
        user = request.user
        schema_name = request.GET.get("schema_name")

        if not schema_name:
            return Response({"error": "schema_name is required"}, status=400)

        ch_queryset = CallCH.objects.using("clickhouse").all()

        # Superuser can see all templates in that org
        if user.is_superuser:
            template_ids = list(
                ch_queryset.filter(schema_name=schema_name)
                .values_list("template_id", flat=True)
                .distinct()
            )

            return Response({
                "templates": [{"template_id": t} for t in sorted(template_ids)]
            })

        # Check org access
        has_org_access = user.accessible_organizations.filter(schema_name=schema_name).exists()
        if not has_org_access:
            return Response({"templates": []})

        # Check language access
        allowed_languages = list(
            user.accessible_languages.values_list("language", flat=True)
        )
        if not allowed_languages:
            return Response({"templates": []})

        # Only templates from selected org + accessible languages
        template_ids = list(
            ch_queryset.filter(
                schema_name=schema_name,
                language__in=allowed_languages
            )
            .values_list("template_id", flat=True)
            .distinct()
        )

        return Response({
            "templates": [{"template_id": t} for t in sorted(template_ids)]
        })


# ------------------------
# SELECTABLE ENTITIES
# ------------------------
class SelectableEntitiesAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get(self, request):
        user = request.user
        schema_name = request.GET.get("schema_name")
        template_id = request.GET.get("template_id")

        if not schema_name:
            return Response({"error": "schema_name is required"}, status=400)

        if not template_id:
            return Response({"error": "template_id is required"}, status=400)

        try:
            template_id = int(template_id)
        except (TypeError, ValueError):
            return Response({"error": "template_id must be a valid integer"}, status=400)

        ch_queryset = CallCH.objects.using("clickhouse").all()

        # ------------------------
        # ACCESS CONTROL
        # ------------------------
        if not user.is_superuser:
            has_org_access = user.accessible_organizations.filter(schema_name=schema_name).exists()
            if not has_org_access:
                return Response({"entities": []})

            allowed_languages = list(
                user.accessible_languages.values_list("language", flat=True)
            )
            if not allowed_languages:
                return Response({"entities": []})

            ch_queryset = ch_queryset.filter(
                schema_name=schema_name,
                template_id=template_id,
                language__in=allowed_languages
            )
        else:
            ch_queryset = ch_queryset.filter(
                schema_name=schema_name,
                template_id=template_id
            )

        # ------------------------
        # COLLECT UNIQUE ENTITY KEYS
        # ------------------------
        entity_keys = set()

        for call in ch_queryset.only("entities"):
            entities = parse_entities(call.entities)
            entity_keys.update(entities.keys())

        # ------------------------
        # ADD DATATYPE + OPERATORS
        # ------------------------
        from .models import EntityDefinition
        from .entity_operators import OPERATOR_CONFIG

        entities_data = []

        for key in sorted(list(entity_keys)):
            entity_def = EntityDefinition.objects.filter(key=key).first()

            data_type = entity_def.data_type if entity_def else "string"

            operators = OPERATOR_CONFIG.get(data_type, [])

            entities_data.append({
                "key": key,
                "data_type": data_type,
                "operators": operators
            })

        return Response({
            "entities": entities_data
        })


# ------------------------
# SELECTABLE ENTITY VALUES
# ------------------------
class SelectableEntityValuesAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get(self, request):
        user = request.user
        schema_name = request.GET.get("schema_name")
        template_id = request.GET.get("template_id")
        entity_key = request.GET.get("entity_key")

        if not schema_name:
            return Response({"error": "schema_name is required"}, status=400)

        if not template_id:
            return Response({"error": "template_id is required"}, status=400)

        if not entity_key:
            return Response({"error": "entity_key is required"}, status=400)

        try:
            template_id = int(template_id)
        except (TypeError, ValueError):
            return Response({"error": "template_id must be a valid integer"}, status=400)

        ch_queryset = CallCH.objects.using("clickhouse").all()

        # ------------------------
        # ACCESS CONTROL
        # ------------------------
        if not user.is_superuser:
            has_org_access = user.accessible_organizations.filter(schema_name=schema_name).exists()
            if not has_org_access:
                return Response({
                    "entity_key": entity_key,
                    "values": []
                })

            allowed_languages = list(
                user.accessible_languages.values_list("language", flat=True)
            )
            if not allowed_languages:
                return Response({
                    "entity_key": entity_key,
                    "values": []
                })

            ch_queryset = ch_queryset.filter(
                schema_name=schema_name,
                template_id=template_id,
                language__in=allowed_languages
            )
        else:
            ch_queryset = ch_queryset.filter(
                schema_name=schema_name,
                template_id=template_id
            )

        entity_def = EntityDefinition.objects.filter(key=entity_key).first()
        data_type = entity_def.data_type if entity_def else "string"

        values = set()

        for call in ch_queryset.only("entities"):
            entities = parse_entities(call.entities)

            if entity_key not in entities:
                continue

            val = entities.get(entity_key)

            if isinstance(val, list):
                raw_values = val
            else:
                raw_values = [val]

            for v in raw_values:
                if v in [None, ""]:
                    continue

                try:
                    parsed_val = parse_value_by_type(v, data_type)

                    # Normalize response-safe format
                    if data_type == "boolean":
                        values.add(parsed_val)
                    elif data_type in ["number"]:
                        values.add(parsed_val)
                    elif data_type == "date":
                        values.add(parsed_val.isoformat())
                    elif data_type == "datetime":
                        values.add(parsed_val.isoformat())
                    elif data_type == "time":
                        values.add(parsed_val.isoformat())
                    else:
                        values.add(str(parsed_val))

                except Exception:
                    values.add(str(v))

        # Safe sorting for mixed types
        sorted_values = sorted(values, key=lambda x: str(x).lower())

        return Response({
            "entity_key": entity_key,
            "data_type": data_type,
            "values": sorted_values
        })