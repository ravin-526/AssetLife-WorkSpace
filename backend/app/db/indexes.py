from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logger import app_logger


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _to_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

    return None


def _created_sort_key(document: dict[str, Any]) -> tuple[datetime, str]:
    created_at = _to_datetime(document.get("created_at"))
    if created_at is None:
        object_id = document.get("_id")
        if isinstance(object_id, ObjectId):
            created_at = object_id.generation_time
        else:
            created_at = datetime.max.replace(tzinfo=timezone.utc)

    return (created_at, str(document.get("_id", "")))


async def _drop_category_indexes(collection) -> None:
    index_info = await collection.index_information()
    for index_name, details in index_info.items():
        if index_name == "_id_":
            continue

        has_partial = "partialFilterExpression" in details
        reason = "partial index" if has_partial else "non-required index"
        await collection.drop_index(index_name)
        app_logger.info("Dropped categories index %s (%s)", index_name, reason)


async def _cleanup_duplicate_categories(db: AsyncIOMotorDatabase) -> int:
    rows = await db["categories"].find({}).to_list(length=20000)
    grouped: dict[str, list[dict[str, Any]]] = {}

    for row in rows:
        name = _clean_text(row.get("category") or row.get("name"))
        if not name:
            continue
        grouped.setdefault(name.lower(), []).append(row)

    to_delete_ids: list[ObjectId] = []
    for _, documents in grouped.items():
        if len(documents) <= 1:
            continue

        sorted_docs = sorted(documents, key=_created_sort_key)
        for document in sorted_docs[1:]:
            object_id = document.get("_id")
            if isinstance(object_id, ObjectId):
                to_delete_ids.append(object_id)

    if not to_delete_ids:
        return 0

    result = await db["categories"].delete_many({"_id": {"$in": to_delete_ids}})
    return int(result.deleted_count)


async def _cleanup_duplicate_subcategories(db: AsyncIOMotorDatabase) -> int:
    rows = await db["subcategories"].find({}).to_list(length=50000)
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}

    for row in rows:
        category_id = _clean_text(row.get("category_id"))
        name = _clean_text(row.get("name"))
        if not category_id or not name:
            continue
        grouped.setdefault((category_id, name.lower()), []).append(row)

    to_delete_ids: list[ObjectId] = []
    for _, documents in grouped.items():
        if len(documents) <= 1:
            continue

        sorted_docs = sorted(documents, key=_created_sort_key)
        for document in sorted_docs[1:]:
            object_id = document.get("_id")
            if isinstance(object_id, ObjectId):
                to_delete_ids.append(object_id)

    if not to_delete_ids:
        return 0

    result = await db["subcategories"].delete_many({"_id": {"$in": to_delete_ids}})
    return int(result.deleted_count)


async def _cleanup_duplicate_individual_users(db: AsyncIOMotorDatabase) -> int:
    rows = await db["individual_users"].find({"mobile_hash": {"$exists": True, "$ne": None}}).to_list(length=50000)
    grouped: dict[str, list[dict[str, Any]]] = {}

    for row in rows:
        mobile_hash = _clean_text(row.get("mobile_hash"))
        if not mobile_hash:
            continue
        grouped.setdefault(mobile_hash.lower(), []).append(row)

    to_delete_ids: list[ObjectId] = []
    for _, documents in grouped.items():
        if len(documents) <= 1:
            continue

        sorted_docs = sorted(documents, key=_created_sort_key)
        for document in sorted_docs[1:]:
            object_id = document.get("_id")
            if isinstance(object_id, ObjectId):
                to_delete_ids.append(object_id)

    if not to_delete_ids:
        return 0

    result = await db["individual_users"].delete_many({"_id": {"$in": to_delete_ids}})
    return int(result.deleted_count)


async def _safe_step(step_name: str, action) -> None:
    try:
        await action()
    except Exception as error:  # pragma: no cover
        app_logger.warning("Index bootstrap step failed (%s): %s", step_name, error)


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    async def categories_cleanup_and_index() -> None:
        deleted = await _cleanup_duplicate_categories(db)
        if deleted:
            app_logger.info("Removed duplicate categories: %s", deleted)

        await _drop_category_indexes(db["categories"])
        await db["categories"].create_index("category", unique=True)
        app_logger.info("Ensured index: categories.category (unique)")

    async def subcategories_cleanup_and_index() -> None:
        deleted = await _cleanup_duplicate_subcategories(db)
        if deleted:
            app_logger.info("Removed duplicate subcategories: %s", deleted)

        await db["subcategories"].create_index([("category_id", 1), ("name", 1)], unique=True)
        app_logger.info("Ensured index: subcategories.(category_id,name) (unique)")

    async def assets_indexes() -> None:
        await db["assets"].create_index("user_id")
        await db["assets"].create_index("category")
        await db["assets"].create_index("subcategory")
        app_logger.info("Ensured indexes: assets.user_id, assets.category, assets.subcategory")

    async def assets_source_migration() -> None:
        result = await db["assets"].update_many(
            {
                "$or": [
                    {"source": {"$exists": False}},
                    {"source": None},
                    {"source": ""},
                ]
            },
            {"$set": {"source": "manual"}},
        )
        if result.modified_count:
            app_logger.info("Migrated assets missing source field: %s", result.modified_count)

    async def reminders_indexes() -> None:
        await db["reminders"].create_index([("user_id", 1), ("reminder_date", 1)])
        app_logger.info("Ensured index: reminders.(user_id,reminder_date)")

    async def individual_users_cleanup_and_index() -> None:
        deleted = await _cleanup_duplicate_individual_users(db)
        if deleted:
            app_logger.info("Removed duplicate individual_users by mobile_hash: %s", deleted)

        await db["individual_users"].create_index("mobile_hash", unique=True)
        app_logger.info("Ensured index: individual_users.mobile_hash (unique)")

    async def asset_suggestions_indexes() -> None:
        await db["asset_suggestions"].create_index([("user_id", 1), ("status", 1)])
        await db["asset_suggestions"].create_index("email_message_id")
        app_logger.info("Ensured indexes: asset_suggestions.(user_id,status), asset_suggestions.email_message_id")

    async def status_master_indexes() -> None:
        await db["status_master"].create_index("name", unique=True)
        app_logger.info("Ensured index: status_master.name (unique)")

    await _safe_step("categories", categories_cleanup_and_index)
    await _safe_step("subcategories", subcategories_cleanup_and_index)
    await _safe_step("assets", assets_indexes)
    await _safe_step("assets_source_migration", assets_source_migration)
    await _safe_step("reminders", reminders_indexes)
    await _safe_step("individual_users", individual_users_cleanup_and_index)
    await _safe_step("asset_suggestions", asset_suggestions_indexes)
    await _safe_step("status_master", status_master_indexes)
