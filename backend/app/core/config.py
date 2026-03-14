from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "AssetLife API"
    DEBUG: bool = False

    ENCRYPTION_KEY: str = "8QnN9BQ4QaM3e1L7AgViEo3Yf58_u5D6vYxFSJYd3iQ="

    JWT_SECRET_KEY: str = "change-me-in-env"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "assetlife"

    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"
    OTP_STATIC_CODE: str = "123456"
    FRONTEND_APP_URL: str = "http://localhost:3000"

    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REDIRECT_URI: str = ""
    GMAIL_OAUTH_SCOPES: str = "https://www.googleapis.com/auth/gmail.readonly"
    GMAIL_ACCESS_TOKEN: str = ""
    GMAIL_REFRESH_TOKEN: str = ""
    GMAIL_EMAIL_ADDRESS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()