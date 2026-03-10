from datetime import datetime, timedelta, timezone
import random

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.crypto import hash_value
from app.core.exceptions import AuthenticationError, NotFoundError
from app.core.jwt import create_access_token
from app.db.mongo import get_db
from app.schemas.user import AdminLoginRequest, IndividualLoginRequest, TokenResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Authentication"])

_otp_store: dict[str, dict[str, datetime | str]] = {}
_OTP_TTL_MINUTES = 5


class SendOtpRequest(BaseModel):
    mobile: str = Field(min_length=10, max_length=15)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        clean = value.strip().replace(" ", "")
        if not clean.isdigit():
            raise ValueError("Mobile must contain only digits")
        return clean


class VerifyOtpRequest(BaseModel):
    mobile: str = Field(min_length=10, max_length=15)
    otp: str = Field(min_length=4, max_length=8)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        clean = value.strip().replace(" ", "")
        if not clean.isdigit():
            raise ValueError("Mobile must contain only digits")
        return clean


@router.post("/login/admin", response_model=TokenResponse)
async def admin_login(payload: AdminLoginRequest, db=Depends(get_db)) -> TokenResponse:
    user_service = UserService(db)
    user = await user_service.authenticate_admin(payload.username, payload.password)

    token = create_access_token(
        subject=user.id,
        role=user.role.value,
        extra_claims={"username": user.username or ""},
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )


@router.post("/login/individual", response_model=TokenResponse)
async def individual_login(payload: IndividualLoginRequest, db=Depends(get_db)) -> TokenResponse:
    user_service = UserService(db)
    user = await user_service.authenticate_individual(payload.mobile, payload.otp)

    token = create_access_token(
        subject=user.id,
        role=user.role.value,
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest, db=Depends(get_db)) -> dict[str, str]:
    collection = db["individual_users"]
    mobile_hash = hash_value(payload.mobile)

    user = await collection.find_one({"mobile_hash": mobile_hash})
    if not user:
        raise NotFoundError("Individual user not found for this mobile")

    otp = str(random.randint(100000, 999999))
    _otp_store[mobile_hash] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES),
    }

    print(f"Generated OTP for {payload.mobile}: {otp}")
    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest, db=Depends(get_db)) -> dict[str, str]:
    collection = db["individual_users"]
    mobile_hash = hash_value(payload.mobile)

    otp_record = _otp_store.get(mobile_hash)
    if not otp_record:
        raise AuthenticationError("OTP not found. Please request a new OTP")

    expires_at = otp_record.get("expires_at")
    if not isinstance(expires_at, datetime) or expires_at < datetime.now(timezone.utc):
        _otp_store.pop(mobile_hash, None)
        raise AuthenticationError("OTP expired. Please request a new OTP")

    if otp_record.get("otp") != payload.otp:
        raise AuthenticationError("Invalid OTP")

    user = await collection.find_one({"mobile_hash": mobile_hash})
    if not user:
        raise NotFoundError("Individual user not found")

    user_id = str(user["_id"])
    await collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "is_verified": True,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    _otp_store.pop(mobile_hash, None)

    token = create_access_token(subject=user_id, role="individual")
    return {
        "message": "OTP verified successfully",
        "access_token": token,
    }
