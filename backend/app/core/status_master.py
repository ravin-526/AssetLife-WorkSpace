from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_STATUS_NAMES = [
    "Active",
    "In Warranty",
    "Expired",
    "Expiring Soon",
    "Inactive",
    "Lost",
    "Damaged",
]


class StatusValidationError(ValueError):
    pass


def _normalize_status_key(value: Any) -> str:
    text = str(value or "").strip().lower()
    return "".join(char for char in text if char.isalnum())


async def ensure_default_statuses(db) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    for name in DEFAULT_STATUS_NAMES:
        await db["status_master"].update_one(
            {"name": name},
            {"$setOnInsert": {"name": name, "is_active": True, "created_at": now_iso}},
            upsert=True,
        )


async def get_active_status_names(db) -> list[str]:
    await ensure_default_statuses(db)
    rows = await db["status_master"].find({"is_active": {"$ne": False}}).sort([("created_at", 1), ("name", 1)]).to_list(length=200)
    names = [str(row.get("name") or "").strip() for row in rows]
    return [name for name in names if name]


async def get_status_lookup(db) -> tuple[dict[str, str], list[str]]:
    names = await get_active_status_names(db)
    lookup: dict[str, str] = {}
    for name in names:
        lookup[_normalize_status_key(name)] = name
    return lookup, names


def get_default_status_name(status_names: list[str]) -> str | None:
    for name in status_names:
        if _normalize_status_key(name) == _normalize_status_key("Active"):
            return name
    return status_names[0] if status_names else None


def resolve_status_from_lookup(value: Any, lookup: dict[str, str]) -> str | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    normalized = _normalize_status_key(raw)
    return lookup.get(normalized)


def validate_or_map_status(value: Any, lookup: dict[str, str], status_names: list[str]) -> str | None:
    mapped = resolve_status_from_lookup(value, lookup)
    if mapped:
        return mapped

    raw = str(value or "").strip()
    if not raw:
        return None

    allowed = ", ".join(status_names)
    raise StatusValidationError(f"Invalid status '{raw}'. Allowed values: {allowed}")
