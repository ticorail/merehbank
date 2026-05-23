from django.db.utils import OperationalError, ProgrammingError
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import RevokedAccessToken


class RevocableJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        user_auth_tuple = super().authenticate(request)
        if user_auth_tuple is None:
            return None

        user, validated_token = user_auth_tuple
        token_jti = validated_token.get('jti')
        if token_jti:
            try:
                if RevokedAccessToken.objects.filter(jti=token_jti).exists():
                    raise AuthenticationFailed('Ce token a été révoqué. Veuillez vous reconnecter.')
            except (ProgrammingError, OperationalError):
                # The revocation table may not exist yet if migrations haven't been applied.
                pass

        return user, validated_token
