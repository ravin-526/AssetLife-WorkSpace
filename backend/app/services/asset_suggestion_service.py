from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logger import app_logger


class AssetSuggestionService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.collection = db["asset_suggestions"]
        self.assets = db["assets"]

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _as_object_id(value: str) -> ObjectId | None:
        try:
            return ObjectId(value)
        except (InvalidId, TypeError):
            return None

    async def clear_temporary_suggestions(self, user_id: str) -> None:
        await self.collection.delete_many({"user_id": user_id, "status": "pending", "source": "gmail"})

    async def list_suggestions(self, user_id: str, status: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"user_id": user_id, "status": {"$ne": "rejected"}}
        if status:
            query["status"] = status
        cursor = self.collection.find(query).sort("created_at", -1)
        results = await cursor.to_list(length=1000)
        app_logger.info("SUGGESTIONS COUNT: %d (user_id=%s)", len(results), user_id)
        return results

    async def get_suggestion(self, user_id: str, suggestion_id: str) -> dict[str, Any] | None:
        object_id = self._as_object_id(suggestion_id)
        if object_id is None:
            return None
        return await self.collection.find_one({"_id": object_id, "user_id": user_id})

    async def is_already_added(self, user_id: str, item: dict[str, Any]) -> tuple[bool, str | None]:
        email_id = str(item.get("source_email_id") or item.get("email_message_id") or "").strip()
        if email_id:
            existing = await self.assets.find_one({"user_id": user_id, "source_email_id": email_id}, {"_id": 1})
            if existing:
                return True, "source_email_id"

        invoice_number = str(item.get("invoice_number") or "").strip()
        if invoice_number:
            existing = await self.assets.find_one(
                {
                    "user_id": user_id,
                    "invoice_number": {"$regex": f"^{re.escape(invoice_number)}$", "$options": "i"},
                },
                {"_id": 1},
            )
            if existing:
                return True, "invoice_number"

        name = str(item.get("product_name") or "").strip().lower()
        vendor = str(item.get("vendor") or "").strip().lower()
        purchase_date = item.get("purchase_date")
        if name and purchase_date:
            query: dict[str, Any] = {
                "user_id": user_id,
                "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
                "purchase_date": purchase_date,
            }
            if vendor:
                query["vendor"] = {"$regex": f"^{re.escape(vendor)}$", "$options": "i"}
            existing = await self.assets.find_one(
                query,
                {"_id": 1},
            )
            if existing:
                return True, "name_vendor_purchase_date"

        return False, None

    async def create_suggestions(self, user_id: str, item: dict[str, Any], *, already_added: bool) -> int:
        product_name = str(item.get("product_name") or "").strip()
        price = item.get("price")
        invoice_number = str(item.get("invoice_number") or "").strip()
        has_minimum_signal = bool(product_name or price is not None or invoice_number)

        if not has_minimum_signal:
            app_logger.info(
                "Suggestion skipped due to validation failure",
                extra={
                    "user_id": user_id,
                    "source_email_id": str(item.get("source_email_id") or item.get("email_message_id") or ""),
                },
            )
            return 0

        document = {
            "user_id": user_id,
            "product_name": product_name or "Unknown Asset",
            "brand": item.get("brand"),
            "vendor": item.get("vendor"),
            "price": price,
            "currency": item.get("currency") or "INR",
            "invoice_amount": item.get("invoice_amount"),
            "invoice_currency": item.get("invoice_currency") or item.get("currency") or "INR",
            "exchange_rate": item.get("exchange_rate"),
            "original_amount": item.get("original_amount"),
            "original_currency": item.get("original_currency"),
            "purchase_date": item.get("purchase_date"),
            "invoice_number": item.get("invoice_number"),
            "description": item.get("description"),
            "sender": item.get("sender"),
            "subject": item.get("subject"),
            "email_date": item.get("email_date"),
            "quantity": int(item.get("quantity") or 1),
            "source": "gmail",
            "status": "pending",
            "warranty": item.get("warranty"),
            "email_message_id": item.get("source_email_id") or item.get("email_message_id") or "",
            "attachment_filename": item.get("attachment_filename"),
            "attachment_mime_type": item.get("attachment_mime_type"),
            "invoice_attachment_path": item.get("invoice_attachment_path"),
            "already_added": bool(already_added),
            "created_at": self._now_iso(),
            "updated_at": self._now_iso(),
        }
        await self.collection.insert_one(document)
        return 1

    async def clear_temporary_after_flow(self, user_id: str) -> int:
        result = await self.collection.delete_many(
            {
                "user_id": user_id,
                "source": "gmail",
                "already_added": {"$ne": True},
            }
        )
        return int(result.deleted_count)
