from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field

from app.models.role import RoleName


class UserInDB(BaseModel):
    id: str | None = Field(default=None, alias="_id")
    role: RoleName
    username: str | None = None
    password_hash: str | None = None

    name: str
    mobile: str
    mobile_hash: str
    dob: str
    pan: str

    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(populate_by_name=True)

    @classmethod
    def from_mongo(cls, data: dict[str, Any]) -> "UserInDB":
        transformed = data.copy()
        if "_id" in transformed:
            transformed["_id"] = str(transformed["_id"])
        return cls.model_validate(transformed)

    def to_mongo(self) -> dict[str, Any]:
        payload = self.model_dump(by_alias=True, exclude_none=True)
        if payload.get("_id"):
            payload["_id"] = ObjectId(payload["_id"])
        return payload
