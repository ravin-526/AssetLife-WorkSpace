from __future__ import annotations

import base64
import json
import os
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from fastapi import HTTPException
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.core.crypto import decrypt_value, encrypt_value


load_dotenv()


class GmailService:
    AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
    API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.integrations = db["gmail_integrations"]

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _normalize_user_id(user_id: str) -> ObjectId | str:
        try:
            return ObjectId(user_id)
        except InvalidId:
            return user_id

    @staticmethod
    def _decode_jwt_part(token: str, part_index: int) -> dict[str, Any] | None:
        try:
            parts = token.split(".")
            if len(parts) != 3:
                return None
            raw = parts[part_index]
            padded = raw + "=" * (-len(raw) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
            value = json.loads(decoded)
            return value if isinstance(value, dict) else None
        except Exception:
            return None

    @staticmethod
    async def _safe_json_request(
        url: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        request_headers = dict(headers or {})
        request_kwargs: dict[str, Any] = {
            "method": method,
            "url": url,
            "headers": request_headers,
        }

        if data is not None:
            request_kwargs["data"] = data
            request_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.request(**request_kwargs)
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise HTTPException(status_code=502, detail=f"Gmail API request failed: {error}") from error

        try:
            parsed = response.json() if response.content else {}
        except json.JSONDecodeError:
            parsed = {}
        return parsed if isinstance(parsed, dict) else {}

    def _is_oauth_configured(self) -> bool:
        return bool(
            os.getenv("GOOGLE_CLIENT_ID")
            and os.getenv("GOOGLE_CLIENT_SECRET")
            and os.getenv("GOOGLE_REDIRECT_URI")
        )

    @staticmethod
    def _get_google_oauth_credentials() -> tuple[str, str, str]:
        client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
        client_secret = (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
        redirect_uri = (os.getenv("GOOGLE_REDIRECT_URI") or "").strip()

        missing: list[str] = []
        if not client_id:
            missing.append("GOOGLE_CLIENT_ID")
        if not client_secret:
            missing.append("GOOGLE_CLIENT_SECRET")
        if not redirect_uri:
            missing.append("GOOGLE_REDIRECT_URI")

        if missing:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Missing required Google OAuth environment variables: "
                    + ", ".join(missing)
                    + ". Set them in backend/.env."
                ),
            )

        return client_id, client_secret, redirect_uri

    def _env_tokens_available(self) -> bool:
        return bool(settings.GMAIL_ACCESS_TOKEN)

    async def _get_profile_email(self, user_id: str) -> str | None:
        normalized_user_id = self._normalize_user_id(user_id)

        individual = await self.db["individual_users"].find_one({"_id": normalized_user_id}, {"encrypted_email": 1})
        encrypted_email = (individual or {}).get("encrypted_email")
        if isinstance(encrypted_email, str) and encrypted_email:
            try:
                email = decrypt_value(encrypted_email).strip().lower()
                if email:
                    return email
            except Exception:
                pass

        user = await self.db["users"].find_one({"_id": normalized_user_id}, {"email": 1})
        plain_email = str((user or {}).get("email") or "").strip().lower()
        return plain_email or None

    async def _set_profile_email(self, user_id: str, email: str | None) -> None:
        normalized_email = str(email or "").strip().lower()
        if not normalized_email:
            return

        normalized_user_id = self._normalize_user_id(user_id)
        await self.db["individual_users"].update_one(
            {"_id": normalized_user_id},
            {"$set": {"encrypted_email": encrypt_value(normalized_email), "updated_at": self._now()}},
        )
        await self.db["users"].update_one(
            {"_id": normalized_user_id},
            {"$set": {"email": normalized_email, "updated_at": self._now()}},
        )

    async def set_profile_email(self, user_id: str, email: str) -> str:
        normalized_email = str(email or "").strip().lower()
        await self._set_profile_email(user_id, normalized_email)
        return normalized_email

    async def get_connection_status(self, user_id: str) -> dict[str, Any]:
        doc = await self.integrations.find_one({"user_id": self._normalize_user_id(user_id), "provider": "gmail"})
        if doc:
            return {
                "connected": bool(doc.get("connected", False)),
                "mailbox_type": str(doc.get("provider") or "gmail"),
                "email_address": doc.get("email_address"),
                "last_sync_at": doc.get("last_sync_at"),
            }

        if self._env_tokens_available():
            return {
                "connected": True,
                "mailbox_type": "gmail",
                "email_address": settings.GMAIL_EMAIL_ADDRESS,
                "last_sync_at": None,
            }

        profile_email = await self._get_profile_email(user_id)
        return {"connected": False, "mailbox_type": "gmail", "email_address": profile_email, "last_sync_at": None}

    async def start_connection(self, user_id: str, email: str | None, source: str = "web") -> dict[str, str]:
        normalized_email = (email or "").strip().lower()
        normalized_source = (source or "web").strip().lower()
        if normalized_source not in {"web", "mobile"}:
            normalized_source = "web"
        now = self._now()
        profile_email = await self._get_profile_email(user_id)
        existing = await self.integrations.find_one({"user_id": self._normalize_user_id(user_id), "provider": "gmail"})
        effective_email = normalized_email or profile_email or str((existing or {}).get("email_address") or "").strip().lower() or None

        # Compose state as base64-encoded JSON with source
        state_obj = {"source": normalized_source, "nonce": secrets.token_urlsafe(8)}
        state_json = json.dumps(state_obj)
        state_bytes = state_json.encode("utf-8")
        state_b64 = base64.urlsafe_b64encode(state_bytes).decode("utf-8").rstrip("=")

        if self._env_tokens_available() and not self._is_oauth_configured():
            final_email = effective_email or settings.GMAIL_EMAIL_ADDRESS or None
            await self.integrations.update_one(
                {"user_id": self._normalize_user_id(user_id), "provider": "gmail"},
                {
                    "$set": {
                        "user_id": self._normalize_user_id(user_id),
                        "provider": "gmail",
                        "connected": True,
                        "email_address": final_email,
                        "pending_email": final_email,
                        "access_token": settings.GMAIL_ACCESS_TOKEN,
                        "refresh_token": settings.GMAIL_REFRESH_TOKEN,
                        "token_expiry": None,
                        "updated_at": now,
                        "created_at": now,
                        "oauth_mode": "env",
                        "oauth_source": normalized_source,
                        "oauth_state": state_b64,
                    }
                },
                upsert=True,
            )
            await self._set_profile_email(user_id, final_email)
            return {"auth_url": "/assets/add?method=email_sync&status=connected", "state": state_b64}

        if not self._is_oauth_configured():
            raise HTTPException(status_code=400, detail="Gmail OAuth is not configured")

        client_id, _, redirect_uri = self._get_google_oauth_credentials()
        print("FINAL REDIRECT URI:", redirect_uri)

        scope = settings.GMAIL_OAUTH_SCOPES or "https://www.googleapis.com/auth/gmail.readonly"
        query = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": scope,
            "access_type": "offline",
            "prompt": "consent",
            "state": state_b64,
        }
        if effective_email:
            query["login_hint"] = effective_email

        await self.integrations.update_one(
            {"user_id": self._normalize_user_id(user_id), "provider": "gmail"},
            {
                "$set": {
                    "user_id": self._normalize_user_id(user_id),
                    "provider": "gmail",
                    "connected": False,
                    "email_address": effective_email,
                    "pending_email": effective_email,
                    "oauth_state": state_b64,
                    "oauth_source": normalized_source,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )

        auth_url = f"{self.AUTH_ENDPOINT}?{urllib.parse.urlencode(query)}"
        return {"auth_url": auth_url, "state": state_b64}

    async def complete_connection(self, user_id: str, code: str, state: str) -> None:
        integration = await self.integrations.find_one({"user_id": self._normalize_user_id(user_id), "provider": "gmail"})
        if not integration:
            raise HTTPException(status_code=400, detail="No Gmail connection request found")

        expected_state = integration.get("oauth_state")
        if expected_state and expected_state != state:
            raise HTTPException(status_code=400, detail="Invalid Gmail OAuth state")

        if not self._is_oauth_configured():
            raise HTTPException(status_code=400, detail="Gmail OAuth is not configured")

        client_id, client_secret, redirect_uri = self._get_google_oauth_credentials()

        token_payload = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        token_response = await self._safe_json_request(self.TOKEN_ENDPOINT, method="POST", data=token_payload)

        access_token = str(token_response.get("access_token") or "")
        if not access_token:
            raise HTTPException(status_code=400, detail="Gmail OAuth token exchange failed")

        refresh_token = token_response.get("refresh_token")
        expires_in = int(token_response.get("expires_in") or 3600)
        id_token = str(token_response.get("id_token") or "")
        token_email = None
        if id_token:
            id_payload = self._decode_jwt_part(id_token, 1)
            token_email = (id_payload or {}).get("email")

        final_email = str(token_email or integration.get("pending_email") or integration.get("email_address") or "").strip().lower() or None

        now = self._now()
        await self.integrations.update_one(
            {"user_id": self._normalize_user_id(user_id), "provider": "gmail"},
            {
                "$set": {
                    "connected": True,
                    "access_token": access_token,
                    "refresh_token": refresh_token or integration.get("refresh_token"),
                    "token_expiry": now + timedelta(seconds=expires_in - 60),
                    "email_address": final_email,
                    "oauth_state": None,
                    "pending_email": None,
                    "oauth_mode": "oauth",
                    "updated_at": now,
                }
            },
        )
        await self._set_profile_email(user_id, final_email)

    async def complete_connection_via_state(self, code: str, state: str) -> dict[str, Any]:
        integration = await self.integrations.find_one({"provider": "gmail", "oauth_state": state})
        if not integration:
            raise HTTPException(status_code=400, detail="Invalid or expired Gmail OAuth state")

        user_id = str(integration.get("user_id"))
        oauth_source = str(integration.get("oauth_source") or "web").strip().lower()
        await self.complete_connection(user_id, code, state)
        status = await self.get_connection_status(user_id)
        status["oauth_source"] = oauth_source
        return status

    async def disconnect(self, user_id: str) -> None:
        now = self._now()
        await self.integrations.update_one(
            {"user_id": self._normalize_user_id(user_id), "provider": "gmail"},
            {
                "$set": {
                    "connected": False,
                    "access_token": None,
                    "refresh_token": None,
                    "token_expiry": None,
                    "oauth_state": None,
                    "updated_at": now,
                }
            },
            upsert=True,
        )

    async def get_valid_access_token(self, user_id: str) -> str:
        integration = await self.integrations.find_one({"user_id": self._normalize_user_id(user_id), "provider": "gmail"})
        if not integration:
            if self._env_tokens_available():
                return str(settings.GMAIL_ACCESS_TOKEN)
            raise HTTPException(status_code=400, detail="Gmail is not connected")

        if not integration.get("connected"):
            raise HTTPException(status_code=400, detail="Gmail is not connected")

        token = str(integration.get("access_token") or "")
        expiry = integration.get("token_expiry")
        if isinstance(expiry, datetime) and expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if token and isinstance(expiry, datetime) and expiry > self._now() + timedelta(seconds=30):
            return token

        refresh_token = str(integration.get("refresh_token") or "")
        if not refresh_token:
            raise HTTPException(status_code=400, detail="Gmail connection does not have a refresh token. Reconnect Gmail.")

        if not self._is_oauth_configured():
            raise HTTPException(status_code=400, detail="Gmail OAuth is not configured")

        client_id, client_secret, _ = self._get_google_oauth_credentials()

        token_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        token_response = await self._safe_json_request(self.TOKEN_ENDPOINT, method="POST", data=token_payload)

        refreshed_token = str(token_response.get("access_token") or "")
        if not refreshed_token:
            raise HTTPException(status_code=400, detail="Failed to refresh Gmail access token")

        expires_in = int(token_response.get("expires_in") or 3600)
        now = self._now()
        await self.integrations.update_one(
            {"_id": integration["_id"]},
            {"$set": {"access_token": refreshed_token, "token_expiry": now + timedelta(seconds=expires_in - 60), "updated_at": now}},
        )
        return refreshed_token

    def _gmail_headers(self, access_token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}

    async def search_messages(self, access_token: str, query: str, max_results: int = 100) -> list[str]:
        params = urllib.parse.urlencode({"q": query, "maxResults": max_results})
        url = f"{self.API_BASE}/messages?{params}"
        payload = await self._safe_json_request(url, headers=self._gmail_headers(access_token))
        messages = payload.get("messages")
        if not isinstance(messages, list):
            return []
        ids: list[str] = []
        for item in messages:
            if isinstance(item, dict) and isinstance(item.get("id"), str):
                ids.append(item["id"])
        return ids

    async def get_message(self, access_token: str, message_id: str) -> dict[str, Any]:
        url = f"{self.API_BASE}/messages/{message_id}?format=full"
        return await self._safe_json_request(url, headers=self._gmail_headers(access_token))

    async def get_attachment_data(self, access_token: str, message_id: str, attachment_id: str) -> bytes:
        url = f"{self.API_BASE}/messages/{message_id}/attachments/{attachment_id}"
        payload = await self._safe_json_request(url, headers=self._gmail_headers(access_token))
        encoded_data = payload.get("data")
        if not isinstance(encoded_data, str) or not encoded_data:
            return b""
        padded = encoded_data + "=" * (-len(encoded_data) % 4)
        return base64.urlsafe_b64decode(padded.encode("utf-8"))