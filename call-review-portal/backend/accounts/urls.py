from django.urls import path
from .views import ForgotPasswordView, ResetPasswordView
from .views import CustomTokenObtainPairView, CookieTokenRefreshView, LogoutView
from .views import MeView

urlpatterns = [
    path('auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('auth/reset-password/<str:uidb64>/<str:token>/', ResetPasswordView.as_view(), name='reset-password'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', CookieTokenRefreshView.as_view(), name='refresh'),
    path('auth/me/', MeView.as_view(), name='me'),
]

