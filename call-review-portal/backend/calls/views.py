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

from .models import Call
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

        allowed_languages = user.accessible_languages.all()

        if not allowed_languages.exists():
            return queryset.none()

        return queryset.filter(language__in=allowed_languages)