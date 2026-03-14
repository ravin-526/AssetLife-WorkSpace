from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase


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
        return await cursor.to_list(length=1000)

    async def get_suggestion(self, user_id: str, suggestion_id: str) -> dict[str, Any] | None:
        object_id = self._as_object_id(suggestion_id)
        if object_id is None:
            return None
        return await self.collection.find_one({"_id": object_id, "user_id": user_id})

    async def is_already_added(self, user_id: str, item: dict[str, Any]) -> bool:
        email_id = str(item.get("source_email_id") or item.get("email_message_id") or "").strip()
        if email_id:
            existing = await self.assets.find_one({"user_id": user_id, "source_email_id": email_id}, {"_id": 1})
            if existing:
                return True

        name = str(item.get("product_name") or "").strip().lower()
        vendor = str(item.get("vendor") or "").strip().lower()
        purchase_date = item.get("purchase_date")
        if name and purchase_date:
            existing = await self.assets.find_one(
                {
                    "user_id": user_id,
                    "$expr": {
                        "$and": [
                            {"$eq": [{"$toLower": "$name"}, name]},
                            {"$eq": [{"$ifNull": ["$purchase_date", None]}, purchase_date]},
                        ]
                    },
                    "vendor": {"$regex": f"^{vendor}$", "$options": "i"} if vendor else {"$exists": True},
                },
                {"_id": 1},
            )
            if existing:
                return True

        return False

    async def create_suggestions(self, user_id: str, item: dict[str, Any], *, already_added: bool) -> int:
        document = {
            "user_id": user_id,
            "product_name": item.get("product_name") or "Unknown Asset",
            "brand": item.get("brand"),
            "vendor": item.get("vendor"),
            "price": item.get("price"),
            "purchase_date": item.get("purchase_date"),
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
