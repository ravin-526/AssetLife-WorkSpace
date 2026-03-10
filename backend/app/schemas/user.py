from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.role import RoleName


class UserBase(BaseModel):
    role: RoleName
    name: str = Field(min_length=2, max_length=120)
    mobile: str = Field(min_length=10, max_length=15)
    dob: str = Field(min_length=4, max_length=20)
    pan: str = Field(min_length=4, max_length=20)
    is_active: bool = True

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        clean = value.strip().replace(" ", "")
        if not clean.isdigit():
            raise ValueError("Mobile must contain only digits")
        return clean


class UserCreate(UserBase):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdate(BaseModel):
    role: RoleName | None = None
    name: str | None = Field(default=None, min_length=2, max_length=120)
    mobile: str | None = Field(default=None, min_length=10, max_length=15)
    dob: str | None = Field(default=None, min_length=4, max_length=20)
    pan: str | None = Field(default=None, min_length=4, max_length=20)
    is_active: bool | None = None
    username: str | None = Field(default=None, min_length=3, max_length=50)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: str
    role: RoleName
    username: str | None = None
    name: str
    mobile: str
    dob: str
    pan: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class IndividualLoginRequest(BaseModel):
    mobile: str
    otp: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
