from datetime import datetime, timedelta, timezone
import random
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.crypto import encrypt_value, hash_value
from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.core.jwt import create_access_token
from app.core.logger import app_logger
from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/individual", tags=["Individual"])

_otp_store: dict[str, dict[str, datetime | str]] = {}
_OTP_TTL_SECONDS = 30


class IndividualRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(min_length=10, max_length=15)
    email: str = Field(min_length=5, max_length=120)
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
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
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
        "encrypted_email": encrypt_value(payload.email),
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

    otp = str(random.randint(100000, 999999))
    _otp_store[mobile_hash] = {
        "otp": otp,
        "created_at": datetime.utcnow(),
    }

    if settings.DEBUG:
        print(f"Generated OTP for {payload.mobile}: {otp}")

    return {
        "message": "OTP sent. Please verify to complete registration.",
        "user_id": user_id,
    }


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
        "created_at": datetime.utcnow(),
    }

    if settings.DEBUG:
        print(f"Generated OTP for {payload.mobile}: {otp}")

    app_logger.info("OTP generated for individual login", extra={"user_id": str(user["_id"])})
    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest, db=Depends(get_db)) -> dict[str, str]:
    collection = db["individual_users"]
    mobile_hash = hash_value(payload.mobile)

    otp_record = _otp_store.get(mobile_hash)
    if not otp_record:
        raise AuthenticationError("OTP not found. Please request a new OTP")

    created_at = otp_record.get("created_at")
    if not isinstance(created_at, datetime):
        _otp_store.pop(mobile_hash, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")

    if datetime.utcnow() - created_at > timedelta(seconds=_OTP_TTL_SECONDS):
        _otp_store.pop(mobile_hash, None)
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new OTP.")

    if otp_record.get("otp") != payload.otp:
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

    _otp_store.pop(mobile_hash, None)

    token = create_access_token(subject=user_id, role="individual")
    app_logger.info("Individual OTP verified", extra={"user_id": user_id})
    return {
        "message": "OTP verified successfully",
        "access_token": token,
    }


@router.get("/profile")
async def get_individual_profile(
    current_user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    return {
        "message": "Profile fetched successfully",
        "user_id": current_user["id"],
        "role": current_user["role"],
        "username": current_user.get("username", ""),
    }


@router.put("/update")
async def update_individual_user(
    user_id: str = Query(..., description="Individual user id"),
    update_data: dict[str, Any] = Body(..., description="Fields to update"),
    _current_user: dict[str, str] = Depends(get_current_user),
    db=Depends(get_db),
) -> dict[str, str]:
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
        payload["updated_at"] = datetime.now(timezone.utc)

        await collection.update_one({"_id": object_id}, {"$set": payload})

        return {"message": "User updated successfully"}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
