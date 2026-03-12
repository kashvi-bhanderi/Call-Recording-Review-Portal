
from subprocess import call
from urllib import request

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from rest_framework.generics import ListAPIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Call, CallCH, Tag
from accounts.models import Language, User
from .serializers import DashboardCallSerializer
from .filters import DashboardCallFilter
from accounts.authentication import CookieJWTAuthentication
from .services import acquire_lock, release_lock
from .models import Call, EvaluationMetric, EvaluationCallRating
from rest_framework import status
from .serializers import EvaluationCallRatingSerializer
from datetime import timedelta
from django.utils import timezone
from .services import acquire_lock, check_lock_expiry

from .services import check_lock_expiry, LOCK_DURATION

# ------------------------
# CONSULTANT SUBMIT
# ------------------------
class SubmitCallReviewAPIView(APIView):

    def post(self, request):

        call_uuid = request.data.get("call_uuid")
        call = Call.objects.filter(uuid=call_uuid).first()

        if call:

            check_lock_expiry(call)

            if call.rating_locked:
                return Response(
                    {"error": "Lead is reviewing this call"},
                    status=403
                )

        serializer = EvaluationCallRatingSerializer(data=request.data)

        if serializer.is_valid():

            call = serializer.create_or_update_ratings(user=request.user)

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

        if not user.is_superuser:
            allowed_languages = list(user.accessible_languages.values_list("language", flat=True))
            if not allowed_languages:
                return queryset.none()
            queryset = queryset.filter(language__in=allowed_languages)

        # POSTGRES FILTERING
        status = self.request.GET.get("status")
        rated_by = self.request.GET.get("rated_by")
        tags = self.request.GET.get("tags")

        if status:
            uuids = Call.objects.filter(status__in=status.split(",")).values_list("uuid", flat=True)
            queryset = queryset.filter(uuid__in=list(uuids))

        if rated_by:
            uuids = Call.objects.filter(rated_by_id=rated_by).values_list("uuid", flat=True)
            queryset = queryset.filter(uuid__in=list(uuids))

        if tags:
            uuids = Call.objects.filter(tags__id__in=tags.split(",")).values_list("uuid", flat=True)
            queryset = queryset.filter(uuid__in=list(uuids))

        return queryset

    def get_serializer_context(self):
        # Add calls_map and users_map so serializer can access Postgres objects
        context = super().get_serializer_context()

        # Map uuid -> Call object (Postgres)
        call_uuids = [obj.uuid for obj in self.get_queryset()]
        calls_map = {c.uuid: c for c in Call.objects.filter(uuid__in=call_uuids).prefetch_related("tags", "evaluationcallrating_set")}

        # Map user_id -> User object
        user_ids = [c.rated_by_id for c in calls_map.values() if c.rated_by_id]
        users_map = {u.id: u for u in User.objects.filter(id__in=user_ids)}

        context["calls_map"] = calls_map
        context["users_map"] = users_map

        return context

# ------------------------
# FILTER OPTIONS
# ------------------------
class CallFilterOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # --------------------
        # LANGUAGE OPTIONS
        # --------------------
        codes = CallCH.objects.using("clickhouse").values_list("language", flat=True).distinct()
        languages = Language.objects.filter(language__in=list(codes)).values("language", "language_name")

        # --------------------
        # SCHEMA OPTIONS
        # --------------------
        schemas = CallCH.objects.using("clickhouse").exclude(schema_name__isnull=True)\
                     .exclude(schema_name__exact="")\
                     .values_list("schema_name", flat=True).distinct()

        # --------------------
        # STATUS OPTIONS
        # --------------------
        statuses = [
            {"value": 1, "label": "Not Rated"},
            {"value": 2, "label": "Completed"},
            {"value": 3, "label": "Need Fix"},
            {"value": 4, "label": "Approved"},
        ]

        # --------------------
        # RATED BY (Postgres)
        # --------------------
        rated_by = User.objects.filter(consultant_rated_calls__isnull=False)\
                     .distinct().values("id", "username")

        # --------------------
        # TAGS
        # --------------------
        tags = Tag.objects.all().values("id", "name")

        return Response({
            "languages": list(languages),
            "schemas": list(schemas),
            "statuses": statuses,
            "rated_by": list(rated_by),
            "tags": list(tags),
        })
    
from .services import check_lock_expiry, LOCK_DURATION

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

        # check if lock expired
        check_lock_expiry(call)

        is_locked = call.rating_locked

        metrics = EvaluationMetric.objects.filter(is_active=True)

        ratings = EvaluationCallRating.objects.filter(
            call=call,
            rated_by=request.user
        )

        ratings_map = {r.parameter.name: r.rating for r in ratings}

        lang_obj = Language.objects.filter(language=ch_call.language).first()
        language_name = lang_obj.language_name if lang_obj else ch_call.language

        data = {
            "metadata": {
                "schema_name": ch_call.schema_name,
                "language": language_name,
                "uuid": ch_call.uuid,
                "phone_number": ch_call.phone_number,
                "duration": ch_call.duration,
                "attempt_on_time_stamp": ch_call.attempt_on_time_stamp,
                "status": call.get_status_display()
            },

            "metrics": [
                {
                    "name": m.name,
                    "min": m.min_value,
                    "max": m.max_value,
                    "value": ratings_map.get(m.name)
                }
                for m in metrics
            ],

            "comments": call.consultant_comment or "",
            "is_locked": is_locked
        }

        return Response(data)


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

        # ------------------------
        # ACQUIRE LOCK FOR LEAD
        # ------------------------
        if call.status == 2:
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
                "value": r.rating
            })

        # ------------------------
        # LEAD RATINGS
        # ------------------------
        lead_ratings = EvaluationCallRating.objects.filter(
            call=call,
            rated_by=request.user
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

        data = {

            "metadata": {
                "uuid": ch_call.uuid,
                "schema_name": ch_call.schema_name,
                "phone_number": ch_call.phone_number,
                "duration": ch_call.duration,
                "language": language_name,
                "attempt_on_time_stamp": ch_call.attempt_on_time_stamp,
                "status": call.get_status_display(),
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


class LeadSubmitReviewAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        call_uuid = request.data.get("call_uuid")
        ratings = request.data.get("ratings", {})
        comment = request.data.get("comment")
        tags = request.data.get("tags", [])
        status = request.data.get("status")

        try:
            status = int(status)
        except (TypeError, ValueError):
            return Response({"error": "Valid status is required"}, status=400)

        if status not in [3, 4]:
            return Response({"error": "Status must be 3 (Need Fix) or 4 (Approved)"}, status=400)

        call = Call.objects.get(uuid=call_uuid)

        if call.status not in [2, 3, 4]:
            return Response(
                {"error": "Consultant must complete review first"},
                status=403
            )

        with transaction.atomic():
            # Save ratings
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

            # Update call only after status is confirmed
            call.update_status(int(status))
            call.lead_comment = comment
            call.reviewed_by = request.user
            call.reviewed_at = timezone.now()
            call.tags.set(tags)
            call.save()

            if call.status in [3, 4]:
                release_lock(call)

        return Response({"message": "Lead review submitted"})