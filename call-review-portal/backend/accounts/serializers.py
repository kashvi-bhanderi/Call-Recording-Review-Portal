from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['role'] = user.role  # assuming your User model has a 'role' field
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Add role to response data
        data['role'] = self.user.role
        return data