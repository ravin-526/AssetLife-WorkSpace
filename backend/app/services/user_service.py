from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value, hash_sha256
from app.core.exceptions import AuthenticationError, BadRequestError, ConflictError, NotFoundError
from app.models.role import ADMIN_ROLES, RoleName
from app.models.user import UserInDB
from app.schemas.user import UserCreate, UserResponse, UserUpdate


class UserService:
    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self.collection = database["users"]
        self.password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    @staticmethod
    def _to_object_id(user_id: str) -> ObjectId:
        try:
            return ObjectId(user_id)
        except InvalidId as error:
            raise BadRequestError("Invalid user id") from error

    def _encrypt_personal_fields(self, payload: dict[str, Any]) -> dict[str, Any]:
        encrypted = payload.copy()
        for key in ("name", "mobile", "dob", "pan"):
            if key in encrypted and encrypted[key] is not None:
                encrypted[key] = encrypt_value(str(encrypted[key]))

        mobile_value = payload.get("mobile")
        if mobile_value:
            encrypted["mobile_hash"] = hash_sha256(str(mobile_value))

        return encrypted

    @staticmethod
    def _decrypt_personal_fields(document: dict[str, Any]) -> dict[str, Any]:
        decrypted = document.copy()
        for key in ("name", "mobile", "dob", "pan"):
            if key in decrypted and decrypted[key] is not None:
                decrypted[key] = decrypt_value(str(decrypted[key]))
        return decrypted

    def _to_user_response(self, document: dict[str, Any]) -> UserResponse:
        user = UserInDB.from_mongo(document)
        decrypted = self._decrypt_personal_fields(user.model_dump(by_alias=True))
        decrypted["id"] = str(decrypted.pop("_id"))
        decrypted.pop("password_hash", None)
        decrypted.pop("mobile_hash", None)
        return UserResponse.model_validate(decrypted)

    async def _validate_uniqueness(
        self,
        username: str | None,
        mobile: str | None,
        exclude_user_id: str | None = None,
    ) -> None:
        exclude_query = {}
        if exclude_user_id:
            exclude_query = {"_id": {"$ne": self._to_object_id(exclude_user_id)}}

        if username:
            existing = await self.collection.find_one({"username": username, **exclude_query})
            if existing:
                raise ConflictError("Username already exists")

        if mobile:
            mobile_hash = hash_sha256(mobile)
            existing = await self.collection.find_one({"mobile_hash": mobile_hash, **exclude_query})
            if existing:
                raise ConflictError("Mobile already exists")

    @staticmethod
    def _requires_admin_credentials(role: RoleName) -> bool:
        return role in ADMIN_ROLES

    async def create_user(self, payload: UserCreate) -> UserResponse:
        if self._requires_admin_credentials(payload.role):
            if not payload.username or not payload.password:
                raise BadRequestError("username and password are required for Admin/SuperAdmin")

        await self._validate_uniqueness(payload.username, payload.mobile)

        now = datetime.now(timezone.utc)
        user_payload = payload.model_dump()
        plain_password = user_payload.pop("password", None)

        encrypted_payload = self._encrypt_personal_fields(user_payload)
        encrypted_payload["created_at"] = now
        encrypted_payload["updated_at"] = now

        if plain_password:
            encrypted_payload["password_hash"] = self.password_context.hash(plain_password)

        result = await self.collection.insert_one(encrypted_payload)
        created = await self.collection.find_one({"_id": result.inserted_id})
        if not created:
            raise NotFoundError("Failed to create user")

        return self._to_user_response(created)

    async def get_user(self, user_id: str) -> UserResponse:
        document = await self.collection.find_one({"_id": self._to_object_id(user_id)})
        if not document:
            raise NotFoundError("User not found")
        return self._to_user_response(document)

    async def list_users(self, skip: int = 0, limit: int = 50) -> list[UserResponse]:
        cursor = self.collection.find().skip(skip).limit(limit)
        users: list[UserResponse] = []
        async for document in cursor:
            users.append(self._to_user_response(document))
        return users

    async def update_user(self, user_id: str, payload: UserUpdate) -> UserResponse:
        document = await self.collection.find_one({"_id": self._to_object_id(user_id)})
        if not document:
            raise NotFoundError("User not found")

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return self._to_user_response(document)

        username = update_data.get("username")
        mobile = update_data.get("mobile")
        await self._validate_uniqueness(username, mobile, exclude_user_id=user_id)

        password = update_data.pop("password", None)
        encrypted_update = self._encrypt_personal_fields(update_data)
        if password:
            encrypted_update["password_hash"] = self.password_context.hash(password)

        encrypted_update["updated_at"] = datetime.now(timezone.utc)

        await self.collection.update_one(
            {"_id": self._to_object_id(user_id)},
            {"$set": encrypted_update},
        )

        updated = await self.collection.find_one({"_id": self._to_object_id(user_id)})
        if not updated:
            raise NotFoundError("User not found")
        return self._to_user_response(updated)

    async def delete_user(self, user_id: str) -> None:
        result = await self.collection.delete_one({"_id": self._to_object_id(user_id)})
        if result.deleted_count == 0:
            raise NotFoundError("User not found")

    async def authenticate_admin(self, username: str, password: str) -> UserResponse:
        user = await self.collection.find_one({"username": username, "role": {"$in": [role.value for role in ADMIN_ROLES]}})
        if not user:
            raise AuthenticationError("Invalid username or password")

        password_hash = user.get("password_hash")
        if not password_hash or not self.password_context.verify(password, password_hash):
            raise AuthenticationError("Invalid username or password")

        return self._to_user_response(user)

    async def authenticate_individual(self, mobile: str, otp: str) -> UserResponse:
        if otp != settings.OTP_STATIC_CODE:
            raise AuthenticationError("Invalid OTP")

        user = await self.collection.find_one(
            {
                "mobile_hash": hash_sha256(mobile),
                "role": RoleName.INDIVIDUAL.value,
                "is_active": True,
            }
        )
        if not user:
            raise AuthenticationError("Individual user not found")

        return self._to_user_response(user)
