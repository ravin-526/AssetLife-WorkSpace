from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/categories", tags=["Categories"])


def _to_category(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("_id", "")),
        "name": item.get("name", ""),
        "description": item.get("description"),
        "is_active": item.get("is_active", True),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def _to_subcategory(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("_id", "")),
        "name": item.get("name", ""),
        "category_id": item.get("category_id", ""),
        "description": item.get("description"),
        "is_active": item.get("is_active", True),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


@router.get("")
async def list_categories(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    _ = current_user
    rows = await db["categories"].find({"is_active": {"$ne": False}}).sort("name", 1).to_list(length=1000)

    response: list[dict[str, Any]] = []
    for row in rows:
        category_id = str(row.get("_id", ""))
        sub_rows = await db["subcategories"].find({"category_id": category_id, "is_active": {"$ne": False}}).sort("name", 1).to_list(length=1000)
        response.append(
            {
                "category": row.get("name", ""),
                "subcategories": [str(sub.get("name", "")).strip() for sub in sub_rows if str(sub.get("name", "")).strip()],
            }
        )

    return response


@router.post("")
async def create_category(payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    _ = current_user
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing = await db["categories"].find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        return _to_category(existing)

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": name,
        "description": payload.get("description"),
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    result = await db["categories"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_category(doc)


@router.get("/{category_id}/subcategories")
async def list_subcategories(category_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    _ = current_user
    rows = await db["subcategories"].find({"category_id": category_id, "is_active": {"$ne": False}}).sort("name", 1).to_list(length=1000)
    return [_to_subcategory(row) for row in rows]


@router.post("/{category_id}/subcategories")
async def create_subcategory(category_id: str, payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    _ = current_user
    try:
        category_object_id = ObjectId(category_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid category id") from error

    category = await db["categories"].find_one({"_id": category_object_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing = await db["subcategories"].find_one({
        "category_id": category_id,
        "name": {"$regex": f"^{name}$", "$options": "i"},
    })
    if existing:
        return _to_subcategory(existing)

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": name,
        "category_id": category_id,
        "description": payload.get("description"),
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    result = await db["subcategories"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _to_subcategory(doc)
