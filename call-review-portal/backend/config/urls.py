# from django.contrib import admin
# from django.urls import path, include

# from rest_framework_simplejwt.views import (
#     TokenObtainPairView,
#     TokenRefreshView,
# )

# urlpatterns = [

#     path('admin/', admin.site.urls),
#     path('auth/login/', TokenObtainPairView.as_view(), name='login'),
#     path('auth/refresh/', TokenRefreshView.as_view(), name='refresh'),

# ]
from django.contrib import admin
from django.urls import path, include
from accounts.views import CustomTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('', include('accounts.urls')),
]
