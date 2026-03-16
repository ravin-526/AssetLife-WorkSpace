from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/categories", tags=["Categories"])

SAMPLE_CATEGORY_SUBCATEGORIES: dict[str, list[str]] = {
    "Electronics": ["Laptop", "Mobile", "Tablet", "Monitor"],
    "Home Appliances": ["Refrigerator", "Washing Machine", "Air Conditioner"],
    "Furniture": ["Chair", "Table", "Sofa"],
}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


async def _sanitize_and_index_categories(db) -> None:
    categories = await db["categories"].find({}).sort("created_at", 1).to_list(length=5000)
    seen_normalized: set[str] = set()

    for item in categories:
        category_id = str(item.get("_id", "")).strip()
        if not category_id:
            continue

        name = _clean_text(item.get("name"))
        category_value = _clean_text(item.get("category"))
        canonical = name or category_value
        normalized = canonical.lower()
        updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}

        if not canonical:
            # Gracefully handle invalid legacy entries by deactivating them and assigning
            # a deterministic non-empty category value to avoid duplicate-null index errors.
            updates["is_active"] = False
            updates["category"] = f"invalid-{category_id}"
            updates["name"] = item.get("name") or ""
        elif normalized in seen_normalized:
            # Keep first category active and gracefully deactivate duplicates.
            updates["is_active"] = False
            updates["category"] = f"{canonical}-{category_id[:8]}"
            if not name:
                updates["name"] = canonical
        else:
            seen_normalized.add(normalized)
            updates["category"] = canonical
            if not name:
                updates["name"] = canonical

        await db["categories"].update_one({"_id": item["_id"]}, {"$set": updates})

    # Recreate category_1 as a plain unique index after sanitization.
    # Sanitization ensures category is non-empty and duplicates are deactivated/renamed.
    indexes = await db["categories"].index_information()
    if "category_1" in indexes:
        await db["categories"].drop_index("category_1")

    await db["categories"].create_index(
        [("category", 1)],
        name="category_1",
        unique=True,
    )


async def _ensure_sample_data(db) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()

    for category_name, subcategory_names in SAMPLE_CATEGORY_SUBCATEGORIES.items():
        category = await db["categories"].find_one({
            "$or": [
                {"name": {"$regex": f"^{category_name}$", "$options": "i"}},
                {"category": {"$regex": f"^{category_name}$", "$options": "i"}},
            ],
            "is_active": {"$ne": False},
        })

        if not category:
            category_doc = {
                "name": category_name,
                "category": category_name,
                "description": "Auto-seeded sample category",
                "is_active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            insert_result = await db["categories"].insert_one(category_doc)
            category_id = str(insert_result.inserted_id)
        else:
            category_id = str(category.get("_id", "")).strip()

        if not category_id:
            continue

        for subcategory_name in subcategory_names:
            existing_subcategory = await db["subcategories"].find_one({
                "category_id": category_id,
                "name": {"$regex": f"^{subcategory_name}$", "$options": "i"},
                "is_active": {"$ne": False},
            })
            if existing_subcategory:
                continue

            await db["subcategories"].insert_one(
                {
                    "name": subcategory_name,
                    "category_id": category_id,
                    "description": "Auto-seeded sample subcategory",
                    "is_active": True,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            )


def _to_category(item: dict[str, Any]) -> dict[str, Any]:
    object_id = str(item.get("_id", ""))
    name = _clean_text(item.get("name")) or _clean_text(item.get("category"))
    return {
        "id": object_id,
        "_id": object_id,
        "name": name,
        "category": _clean_text(item.get("category")) or name,
        "description": item.get("description"),
        "is_active": item.get("is_active", True),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def _to_subcategory(item: dict[str, Any]) -> dict[str, Any]:
    object_id = str(item.get("_id", ""))
    return {
        "id": object_id,
        "_id": object_id,
        "name": item.get("name", ""),
        "category_id": item.get("category_id", ""),
        "description": item.get("description"),
        "is_active": item.get("is_active", True),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


async def initialize_categories(db) -> None:
    await _sanitize_and_index_categories(db)
    await _ensure_sample_data(db)


@router.get("")
async def list_categories(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    _ = current_user
    try:
        rows = await db["categories"].find({"is_active": {"$ne": False}}).sort("category", 1).to_list(length=1000)
        category_ids: list[str] = []
        normalized_names: dict[str, str] = {}
        for row in rows:
            category_id = str(row.get("_id", "")).strip()
            category_name = _clean_text(row.get("name")) or _clean_text(row.get("category"))
            if not category_id or not category_name:
                continue
            category_ids.append(category_id)
            normalized_names[category_id] = category_name

        subcategories = await db["subcategories"].find(
            {
                "category_id": {"$in": category_ids},
                "is_active": {"$ne": False},
            }
        ).to_list(length=5000)

        subcategory_map: dict[str, list[str]] = {category_id: [] for category_id in category_ids}
        for row in subcategories:
            category_id = str(row.get("category_id", "")).strip()
            name = _clean_text(row.get("name"))
            if not category_id or not name:
                continue
            subcategory_map.setdefault(category_id, []).append(name)

        return [
            {
                "category": normalized_names[category_id],
                "subcategories": sorted(subcategory_map.get(category_id, []), key=str.lower),
            }
            for category_id in category_ids
        ]
    except HTTPException:
        raise
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {error}") from error


@router.post("")
async def create_category(payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    _ = current_user

    name = _clean_text(payload.get("name"))
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing = await db["categories"].find_one({
        "$or": [
            {"name": {"$regex": f"^{name}$", "$options": "i"}},
            {"category": {"$regex": f"^{name}$", "$options": "i"}},
        ],
    })
    if existing:
        return _to_category(existing)

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "name": name,
        "category": name,
        "description": payload.get("description"),
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    try:
        result = await db["categories"].insert_one(doc)
        doc["_id"] = result.inserted_id
        return _to_category(doc)
    except Exception:
        # If a race condition inserts the same category concurrently, return existing.
        existing_after = await db["categories"].find_one({
            "$or": [
                {"name": {"$regex": f"^{name}$", "$options": "i"}},
                {"category": {"$regex": f"^{name}$", "$options": "i"}},
            ],
        })
        if existing_after:
            return _to_category(existing_after)
        raise


@router.get("/{category_id}/subcategories")
async def list_subcategories(category_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    _ = current_user
    try:
        rows = await db["subcategories"].find({"category_id": category_id, "is_active": {"$ne": False}}).sort("name", 1).to_list(length=1000)
        return [_to_subcategory(row) for row in rows]
    except HTTPException:
        raise
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to fetch subcategories: {error}") from error


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
