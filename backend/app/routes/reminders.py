from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])


def _normalize_asset_id(value: Any) -> str | None:
    normalized = str(value or "").strip()
    return normalized or None


def _resolve_reminder_scope(asset_id: str | None) -> str:
    return "asset" if asset_id else "custom"


def _to_reminder(item: dict[str, Any]) -> dict[str, Any]:
    asset_id = _normalize_asset_id(item.get("asset_id"))
    reminder_scope = _resolve_reminder_scope(asset_id)

    return {
        "id": str(item.get("_id", "")),
        "user_id": item.get("user_id", ""),
        "title": item.get("title", ""),
        "asset_id": asset_id,
        "asset_name": item.get("asset_name"),
        "type": reminder_scope,
        "reminder_date": item.get("reminder_date"),
        "reminder_type": item.get("reminder_type", "custom"),
        "status": item.get("status", "active"),
        "notes": item.get("notes"),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


@router.get("")
async def list_reminders(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    items = await db["reminders"].find({"user_id": current_user["id"]}).sort("reminder_date", 1).to_list(length=2000)
    return [_to_reminder(item) for item in items]


@router.post("")
async def create_reminder(payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    title = str(payload.get("title") or "").strip()
    reminder_date = str(payload.get("reminder_date") or "").strip()
    asset_id = _normalize_asset_id(payload.get("asset_id"))
    reminder_scope = _resolve_reminder_scope(asset_id)
    asset_name = str(payload.get("asset_name") or "").strip() if asset_id else None

    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if not reminder_date:
        raise HTTPException(status_code=400, detail="Reminder date is required")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "user_id": current_user["id"],
        "title": title,
        "asset_id": asset_id,
        "asset_name": asset_name,
        "type": reminder_scope,
        "reminder_date": reminder_date,
        "reminder_type": payload.get("reminder_type") or "custom",
        "status": payload.get("status") or "active",
        "notes": payload.get("notes"),
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    result = await db["reminders"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_reminder(doc)


@router.put("/{reminder_id}")
async def update_reminder(reminder_id: str, payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    try:
        object_id = ObjectId(reminder_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid reminder id") from error

    allowed = {"title", "asset_id", "asset_name", "reminder_date", "reminder_type", "status", "notes"}
    update_data = {key: value for key, value in payload.items() if key in allowed}

    existing = await db["reminders"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder not found")

    normalized_asset_id = _normalize_asset_id(update_data.get("asset_id")) if "asset_id" in update_data else _normalize_asset_id(existing.get("asset_id"))
    update_data["asset_id"] = normalized_asset_id
    update_data["type"] = _resolve_reminder_scope(normalized_asset_id)
    if not normalized_asset_id:
        update_data["asset_name"] = None

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db["reminders"].update_one({"_id": object_id, "user_id": current_user["id"]}, {"$set": update_data})
    item = await db["reminders"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_reminder(item)


@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, str]:
    try:
        object_id = ObjectId(reminder_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid reminder id") from error

    result = await db["reminders"].delete_one({"_id": object_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"status": "deleted", "reminder_id": reminder_id}
