from datetime import datetime, timezone
import re
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value, hash_value
from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.core.jwt import create_access_token
from app.core.logger import app_logger
from app.core.security import get_current_user
from app.db.mongo import get_db
from app.services.otp_service import otp_service

router = APIRouter(prefix="/individual", tags=["Individual"])


class IndividualRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(min_length=10, max_length=15)
    email: str | None = Field(default=None, max_length=120)
    dob: str = Field(min_length=4, max_length=20)
    pan: str = Field(min_length=4, max_length=20)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        clean = value.strip().replace(" ", "")
        if not clean.isdigit():
            raise ValueError("Mobile must contain only digits")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None

        email = value.strip().lower()
        if not email:
            return None

        if "@" not in email or "." not in email.split("@")[-1]:
            raise ValueError("Invalid email address")
        return email


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


@router.post("/register")
async def register_individual(payload: IndividualRegisterRequest, db=Depends(get_db)) -> dict[str, str]:
    collection = db["individual_users"]

    mobile_hash = hash_value(payload.mobile)

    existing_user = await collection.find_one({"mobile_hash": mobile_hash})
    if existing_user:
        raise ConflictError("User with the same mobile already exists")

    now = datetime.now(timezone.utc)
    document = {
        "encrypted_name": encrypt_value(payload.name),
        "encrypted_mobile": encrypt_value(payload.mobile),
        "encrypted_email": encrypt_value(payload.email) if payload.email else None,
        "encrypted_dob": encrypt_value(payload.dob),
        "encrypted_pan": encrypt_value(payload.pan),
        "mobile_hash": mobile_hash,
        "is_verified": False,
        "created_at": now,
        "updated_at": now,
    }

    result = await collection.insert_one(document)
    user_id = str(result.inserted_id)
    app_logger.info("Individual user registered", extra={"user_id": user_id})

    otp = otp_service.generate_otp(mobile_hash)

    if settings.DEBUG:
        print(f"Generated OTP for {payload.mobile}: {otp}")

    response_payload: dict[str, str] = {
        "message": "OTP sent. Please verify to complete registration.",
        "user_id": user_id,
    }
    if settings.DEBUG:
        response_payload["debug_otp"] = otp
    return response_payload


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest, db=Depends(get_db)) -> dict[str, str]:
    collection = db["individual_users"]
    mobile_hash = hash_value(payload.mobile)

    user = await collection.find_one({"mobile_hash": mobile_hash})
    if not user:
        raise NotFoundError("Individual user not found for this mobile")

    allowed, retry_after_seconds = otp_service.register_otp_request(mobile_hash)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many OTP requests. Try again in {retry_after_seconds} seconds.",
            headers={"Retry-After": str(retry_after_seconds)},
        )

    otp = otp_service.generate_otp(mobile_hash)

    if settings.DEBUG:
        print(f"Generated OTP for {payload.mobile}: {otp}")

    app_logger.info("OTP generated for individual login", extra={"user_id": str(user["_id"])})
    response_payload: dict[str, str] = {"message": "OTP sent successfully"}
    if settings.DEBUG:
        response_payload["debug_otp"] = otp
    return response_payload


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest, db=Depends(get_db)) -> dict[str, str]:
    collection = db["individual_users"]
    mobile_hash = hash_value(payload.mobile)

    verification_status = otp_service.verify_otp(mobile_hash, payload.otp)
    if verification_status == "not_found":
        raise AuthenticationError("OTP not found. Please request a new OTP")
    if verification_status == "expired":
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")
    if verification_status == "invalid":
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": "Invalid OTP. Please try again.",
            },
        )

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

    token = create_access_token(subject=user_id, role="individual")
    app_logger.info("Individual OTP verified", extra={"user_id": user_id})
    return {
        "message": "OTP verified successfully",
        "access_token": token,
    }


@router.get("/profile")
async def get_individual_profile(
    current_user: dict[str, str] = Depends(get_current_user),
    db=Depends(get_db),
) -> dict[str, str | None]:
    if not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Missing authentication token")

    collection = db["individual_users"]
    try:
        object_id = ObjectId(current_user["id"])
    except InvalidId as error:
        raise HTTPException(status_code=400, detail="Invalid user id") from error

    user = await collection.find_one({"_id": object_id})
    if not user:
        raise NotFoundError("Individual user not found")

    return {
        "id": current_user["id"],
        "name": decrypt_value(user.get("encrypted_name", "")) if user.get("encrypted_name") else "",
        "email": decrypt_value(user.get("encrypted_email", "")) if user.get("encrypted_email") else "",
        "phone": decrypt_value(user.get("encrypted_mobile", "")) if user.get("encrypted_mobile") else "",
        "organization": None,
        "role": current_user["role"],
    }


@router.put("/update")
async def update_individual_user(
    user_id: str = Query(..., description="Individual user id"),
    update_data: dict[str, Any] = Body(..., description="Fields to update"),
    _current_user: dict[str, str] = Depends(get_current_user),
    db=Depends(get_db),
) -> dict[str, str | None]:
    try:
        object_id = ObjectId(user_id)
    except InvalidId as error:
        raise HTTPException(status_code=400, detail="Invalid user_id") from error

    collection = db["individual_users"]

    try:
        user = await collection.find_one({"_id": object_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        payload = update_data.copy()
        payload.pop("_id", None)

        allowed_fields = {"name", "email"}
        unknown_fields = set(payload.keys()) - allowed_fields
        if unknown_fields:
            raise HTTPException(status_code=400, detail=f"Unsupported fields: {', '.join(sorted(unknown_fields))}")

        update_payload: dict[str, Any] = {"updated_at": datetime.now(timezone.utc)}

        if "name" in payload:
            name = str(payload["name"]).strip()
            if len(name) < 2 or len(name) > 120:
                raise HTTPException(status_code=400, detail="Name must be between 2 and 120 characters")
            update_payload["encrypted_name"] = encrypt_value(name)

        if "email" in payload:
            email = str(payload["email"]).strip().lower()
            if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
                raise HTTPException(status_code=400, detail="Please enter a valid email")
            update_payload["encrypted_email"] = encrypt_value(email)

        await collection.update_one({"_id": object_id}, {"$set": update_payload})
        updated_user = await collection.find_one({"_id": object_id})
        if not updated_user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "id": user_id,
            "name": decrypt_value(updated_user.get("encrypted_name", "")) if updated_user.get("encrypted_name") else "",
            "email": decrypt_value(updated_user.get("encrypted_email", "")) if updated_user.get("encrypted_email") else "",
            "phone": decrypt_value(updated_user.get("encrypted_mobile", "")) if updated_user.get("encrypted_mobile") else "",
            "organization": None,
            "role": _current_user["role"],
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
