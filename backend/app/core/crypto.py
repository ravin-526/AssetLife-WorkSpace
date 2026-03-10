import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def hash_sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        raise ValueError("ENCRYPTION_KEY is missing")
    try:
        key_bytes = key.encode("utf-8") if isinstance(key, str) else key
        return Fernet(key_bytes)
    except (TypeError, ValueError) as error:
        raise ValueError("ENCRYPTION_KEY is invalid for Fernet") from error


def encrypt_value(value: str) -> str:
    if not value:
        return value
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return encrypted_value
    try:
        return _get_fernet().decrypt(encrypted_value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Invalid encrypted value")


def hash_value(value: str) -> str:
    return hash_sha256(value)