from __future__ import annotations

from datetime import datetime, timedelta, timezone
import random
from typing import Literal


OtpVerifyStatus = Literal["valid", "not_found", "expired", "invalid"]


class OtpService:
    OTP_TTL_SECONDS = 30
    RATE_LIMIT_WINDOW_SECONDS = 5 * 60
    MAX_OTP_REQUESTS = 5

    def __init__(self) -> None:
        self._otp_store: dict[str, dict[str, datetime | str]] = {}
        self._request_store: dict[str, list[datetime]] = {}

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def _trim_requests(self, mobile_hash: str) -> list[datetime]:
        now = self._now()
        window = timedelta(seconds=self.RATE_LIMIT_WINDOW_SECONDS)
        history = self._request_store.get(mobile_hash, [])
        trimmed = [entry for entry in history if now - entry < window]
        self._request_store[mobile_hash] = trimmed
        return trimmed

    def register_otp_request(self, mobile_hash: str) -> tuple[bool, int]:
        history = self._trim_requests(mobile_hash)
        if len(history) >= self.MAX_OTP_REQUESTS:
            now = self._now()
            oldest = history[0]
            retry_after = int((oldest + timedelta(seconds=self.RATE_LIMIT_WINDOW_SECONDS) - now).total_seconds())
            return False, max(retry_after, 1)

        history.append(self._now())
        self._request_store[mobile_hash] = history
        return True, 0

    def generate_otp(self, mobile_hash: str) -> str:
        otp = f"{random.randint(100000, 999999)}"
        self._otp_store[mobile_hash] = {
            "otp": otp,
            "created_at": self._now(),
        }
        return otp

    def verify_otp(self, mobile_hash: str, otp: str) -> OtpVerifyStatus:
        record = self._otp_store.get(mobile_hash)
        if not record:
            return "not_found"

        created_at = record.get("created_at")
        if not isinstance(created_at, datetime):
            self._otp_store.pop(mobile_hash, None)
            return "expired"

        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        if self._now() - created_at > timedelta(seconds=self.OTP_TTL_SECONDS):
            self._otp_store.pop(mobile_hash, None)
            return "expired"

        stored_otp = str(record.get("otp") or "")
        if stored_otp != otp:
            return "invalid"

        self._otp_store.pop(mobile_hash, None)
        return "valid"


otp_service = OtpService()