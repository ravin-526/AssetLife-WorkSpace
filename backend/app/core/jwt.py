from datetime import datetime, timedelta
from typing import Any

from jose import jwt, JWTError

from app.core.config import settings
from app.core.exceptions import AuthenticationError


def create_access_token(subject: str, role: str, extra_claims: dict[str, Any] | None = None) -> str:
    expire_at = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expire_at,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def verify_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access" or "sub" not in payload or "role" not in payload:
            raise AuthenticationError("Invalid token payload")
        return payload
    except JWTError as error:
        raise AuthenticationError("Invalid or expired token") from error


def verify_token(token: str) -> dict[str, Any]:
    return verify_access_token(token)