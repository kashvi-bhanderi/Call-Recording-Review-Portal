from django.urls import path
from .views import ForgotPasswordView, ResetPasswordView

urlpatterns = [
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('auth/reset-password/<str:uidb64>/<str:token>/', ResetPasswordView.as_view(), name='reset-password'),
]