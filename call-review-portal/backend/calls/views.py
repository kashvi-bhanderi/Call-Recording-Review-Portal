from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db import transaction

from .models import Call
from .services import acquire_lock, release_lock
    
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Prefetch

from .models import Call, Tag       
from accounts.models import Language,User   
from .serializers import DashboardCallSerializer
from .filters import DashboardCallFilter
from accounts.authentication import CookieJWTAuthentication

class LockCallView(APIView):

    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        acquire_lock(call, request.user)
        return Response({"message": "Lock acquired"})


class SubmitConsultantRatingView(APIView):

    @transaction.atomic
    def post(self, request, pk):
        call = Call.objects.get(pk=pk)

        call.update_status(2)
        call.rated_by = request.user
        call.rated_at = timezone.now()
        call.save()

        return Response({"message": "Submitted successfully"})


class ApproveCallView(APIView):

    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        call.update_status(4)
        call.reviewed_at = timezone.now()
        release_lock(call)
        return Response({"message": "Approved"})


class RejectCallView(APIView):

    def post(self, request, pk):
        call = Call.objects.get(pk=pk)
        call.update_status(3)
        release_lock(call)
        return Response({"message": "Rejected"})

class DashboardCallView(ListAPIView):
    serializer_class = DashboardCallSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    filter_backends = [DjangoFilterBackend]
    filterset_class = DashboardCallFilter

    def get_queryset(self):
        user = self.request.user
        queryset = Call.objects.all()

        # Superuser sees all
        if user.is_superuser:
            return queryset

        # Get language codes user has access to
        allowed_languages = list(user.accessible_languages.values_list('language', flat=True))
        if not allowed_languages:
            return queryset.none()

        # Filter calls where language code matches
        return queryset.filter(language__in=allowed_languages)
        
# views.py
class CallFilterOptionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Step 1: get distinct language codes from Call table
        codes = Call.objects.values_list("language", flat=True).distinct()

        # Step 2: fetch language names for these codes
        languages = Language.objects.filter(language__in=codes).values("language", "language_name")

        # Schemas
        schemas = (
            Call.objects
            .exclude(schema_name__isnull=True)
            .exclude(schema_name__exact="")
            .values("schema_name")
            .distinct()
        )

        # Statuses
        statuses = [
            {"value": 1, "label": "Not Rated"},
            {"value": 2, "label": "Completed"},
            {"value": 3, "label": "Need Fix"},
            {"value": 4, "label": "Approved"},
        ]

        # Rated By
        rated_by = (
            User.objects
            .filter(consultant_rated_calls__isnull=False)
            .distinct()
            .values("id", "username")
        )

        # Tags
        tags = Tag.objects.all().values("id", "name")

        return Response({
            "languages": list(languages),
            "schemas": [s["schema_name"] for s in schemas],
            "statuses": statuses,
            "rated_by": list(rated_by),
            "tags": list(tags),
        })