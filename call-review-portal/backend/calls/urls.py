from django.urls import path
from .views import (
    LockCallView,
    SubmitConsultantRatingView,
    ApproveCallView,
    RejectCallView
)
from .views import DashboardCallView, CallFilterOptionsView


urlpatterns = [
    path("<int:pk>/lock/", LockCallView.as_view()),
    path("<int:pk>/submit/", SubmitConsultantRatingView.as_view()),
    path("<int:pk>/approve/", ApproveCallView.as_view()),
    path("<int:pk>/reject/", RejectCallView.as_view()),
    path("dashboard/", DashboardCallView.as_view(), name="dashboard-calls"),
    path("filter-options/", CallFilterOptionsView.as_view(), name="call-filter-options"),
]

