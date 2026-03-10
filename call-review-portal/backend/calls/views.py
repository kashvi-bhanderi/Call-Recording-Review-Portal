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


# ------------------------
# LOCK CALL
# ------------------------
class LockCallView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        acquire_lock(call, request.user)
        return Response({"message": "Lock acquired"})


# ------------------------
# CONSULTANT SUBMIT
# ------------------------
class SubmitConsultantRatingView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        call.update_status(2)
        call.rated_by = request.user
        call.rated_at = timezone.now()
        call.save()
        return Response({"message": "Submitted successfully"})


# ------------------------
# APPROVE
# ------------------------
class ApproveCallView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        call.update_status(4)
        call.reviewed_at = timezone.now()
        release_lock(call)
        return Response({"message": "Approved"})


# ------------------------
# REJECT
# ------------------------
class RejectCallView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        call.update_status(3)
        release_lock(call)
        return Response({"message": "Rejected"})


# ------------------------
# DASHBOARD LIST
# ------------------------
from django.db.models import Prefetch

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