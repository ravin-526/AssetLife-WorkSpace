from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/categories", tags=["Categories"])

FINAL_CATEGORY_SUBCATEGORIES: dict[str, list[str]] = {
    "Electronics": [
        "Mobile Phones",
        "Laptops",
        "Tablets",
        "Desktop PCs",
        "Monitors",
        "Printers & Scanners",
        "Routers & Modems",
        "External Storage (HDD/SSD)",
        "Pendrives",
        "Power Banks",
        "Chargers & Adapters",
        "Smart Speakers",
        "Projectors",
        "Other",
    ],
    "Home Appliances": [
        "Refrigerators",
        "Washing Machines",
        "Air Conditioners",
        "Air Coolers",
        "Televisions",
        "Microwave Ovens",
        "Induction Cooktops",
        "Chimneys",
        "Water Purifiers",
        "Geysers",
        "Vacuum Cleaners",
        "Fans",
        "Other",
    ],
    "Personal Gadgets": [
        "Smart Watches",
        "Fitness Bands",
        "Earbuds",
        "Headphones",
        "VR Headsets",
        "Gaming Consoles",
        "Cameras",
        "Drones",
        "Other",
    ],
    "Furniture": [
        "Beds",
        "Sofas",
        "Chairs",
        "Tables",
        "Wardrobes",
        "TV Units",
        "Office Desks",
        "Bookshelves",
        "Other",
    ],
    "Vehicles": [
        "Cars",
        "Bikes",
        "Scooters",
        "Bicycles",
        "Electric Vehicles",
        "Commercial Vehicles",
        "Other",
    ],
    "Property & Real Estate": [
        "Flats/Apartments",
        "Independent Houses",
        "Plots",
        "Commercial Property",
        "Other",
    ],
    "Financial Assets": [
        "Bank Accounts",
        "Fixed Deposits",
        "Mutual Funds",
        "Stocks",
        "Bonds",
        "Insurance Policies",
        "Loans",
        "Credit Cards",
        "Other",
    ],
    "Documents": [
        "Aadhaar Card",
        "PAN Card",
        "Passport",
        "Driving License",
        "Vehicle RC",
        "Insurance Documents",
        "Property Papers",
        "Birth Certificate",
        "Other",
    ],
    "Subscriptions & Services": [
        "OTT Subscriptions",
        "Software Licenses",
        "Cloud Storage",
        "Gym Membership",
        "Internet/Broadband",
        "Mobile Plans",
        "Other",
    ],
    "Jewelry & Valuables": [
        "Gold Jewelry",
        "Silver Items",
        "Diamonds",
        "Watches",
        "Collectibles",
        "Other",
    ],
    "Education": [
        "Certificates",
        "Degrees",
        "Online Courses",
        "Books",
        "Other",
    ],
    "Other": [
        "Miscellaneous",
        "Uncategorized",
        "Other",
    ],
}


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _dedupe_case_insensitive(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = _clean_text(raw)
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(value)
    return unique


async def _reseed_categories(db) -> None:
    # Required behavior: replace only categories/subcategories master data.
    await db["subcategories"].delete_many({})
    await db["categories"].delete_many({})

    now_iso = datetime.now(timezone.utc).isoformat()

    for category_name, subcategory_names in FINAL_CATEGORY_SUBCATEGORIES.items():
        canonical_category = _clean_text(category_name)
        if not canonical_category:
            continue

        deduped_subcategories = _dedupe_case_insensitive(subcategory_names)
        if canonical_category.lower() != "other" and "other" not in {name.lower() for name in deduped_subcategories}:
            deduped_subcategories.append("Other")

        insert_result = await db["categories"].insert_one(
            {
                "name": canonical_category,
                "category": canonical_category,
                "description": "Finalized master category",
                "is_active": True,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )
        category_id = str(insert_result.inserted_id)

        for subcategory_name in deduped_subcategories:
            await db["subcategories"].insert_one(
                {
                    "name": subcategory_name,
                    "category_id": category_id,
                    "description": "Finalized master subcategory",
                    "is_active": True,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            )


async def _ensure_category_index(db) -> None:
    indexes = await db["categories"].index_information()
    if "category_1" in indexes:
        await db["categories"].drop_index("category_1")

    await db["categories"].create_index(
        [("category", 1)],
        name="category_1",
        unique=True,
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
    try:
        await _ensure_category_index(db)
    except Exception:
        # Keep startup resilient; index bootstrap is handled by app.db.indexes.ensure_indexes.
        return


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
                "sub_categories": sorted(subcategory_map.get(category_id, []), key=str.lower),
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
