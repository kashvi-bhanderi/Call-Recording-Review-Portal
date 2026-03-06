from django.shortcuts import render
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import ForgotPasswordSerializer, ResetPasswordSerializer
from .serializers import CustomTokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated
from .authentication import CookieJWTAuthentication

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer 

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        access = response.data.get("access")
        refresh = response.data.get("refresh")
        role = response.data.get("role")

        res = Response({"role": role}, status=status.HTTP_200_OK)

        #  Set Access Token Cookie
        res.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=False,   # True in production
            samesite="Lax",
            path="/"
        )

        # Set Refresh Token Cookie
        res.set_cookie(
            key="refresh_token",
            value=refresh,
            httponly=True,
            secure=False,
            samesite="Lax",
            path="/"
        )

        return res


class CookieTokenRefreshView(APIView):
    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response({"error": "No refresh token"}, status=401)

        try:
            refresh = RefreshToken(refresh_token)
            access = str(refresh.access_token)

            res = Response({"message": "Token refreshed"}, status=200)

            res.set_cookie(
                key="access_token",
                value=access,
                httponly=True,
                secure=False,
                samesite="Lax",
                path="/"
            )

            return res

        except Exception:
            return Response({"error": "Invalid refresh token"}, status=401)
        
class ForgotPasswordView(APIView):
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Password reset link sent to your email."}, status=status.HTTP_200_OK)

class ResetPasswordView(APIView):
    def post(self, request, uidb64, token):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(uidb64, token)
        return Response({"message": "Password has been reset successfully."}, status=status.HTTP_200_OK)
    
class LogoutView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        res = Response({"message": "Logged out"}, status=200)
        res.delete_cookie("access_token")
        res.delete_cookie("refresh_token")
        return res
    

class MeView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "id": request.user.id,
            "role": request.user.role
        })