from django.urls import path
from .views import (
    LeadCallDetailAPIView,
    LeadSubmitReviewAPIView,
)
from .views import DashboardCallView, CallFilterOptionsView
from .views import SubmitCallReviewAPIView
from .views import ConsultantCallDetailAPIView
from .views import CallAudioAPIView
urlpatterns = [
    path("dashboard/", DashboardCallView.as_view(), name="dashboard-calls"),
    path("filter-options/", CallFilterOptionsView.as_view(), name="call-filter-options"),
    path('consultant-rating/', SubmitCallReviewAPIView.as_view(), name='submit_call_review'),
    path("detail/<str:call_uuid>/", ConsultantCallDetailAPIView.as_view()),
    path("lead-detail/<str:call_uuid>/", LeadCallDetailAPIView.as_view()),
    path("lead-rating/", LeadSubmitReviewAPIView.as_view(), name="lead-rating"),
    path("audio/<str:call_uuid>/", CallAudioAPIView.as_view(), name="call-audio"),
]

