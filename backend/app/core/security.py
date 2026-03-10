from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthorizationError
from app.core.jwt import verify_token
from app.models.role import RoleName


bearer_scheme = HTTPBearer(
    scheme_name="bearerAuth",
    bearerFormat="JWT",
    description="Enter JWT as: Bearer <JWT_TOKEN>",
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict[str, str]:
    token = credentials.credentials.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    try:
        payload = verify_token(token)
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from error

    if not payload.get("sub") or not payload.get("role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    return {
        "id": str(payload["sub"]),
        "role": str(payload["role"]),
        "username": str(payload.get("username", "")),
    }


def require_roles(*allowed_roles: RoleName):
    allowed = {role.value for role in allowed_roles}

    def _dependency(current_user: dict[str, str] = Depends(get_current_user)) -> dict[str, str]:
        if current_user["role"] not in allowed:
            raise AuthorizationError("You do not have permission to perform this action")
        return current_user

    return _dependency