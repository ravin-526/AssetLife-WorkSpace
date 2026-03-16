from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/testing", tags=["Testing"])

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
INVOICE_ROOT = UPLOAD_ROOT / "invoices"


@router.post("/reset-user-data")
async def reset_user_test_data(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    # TEMPORARY TESTING FEATURE: remove before production deployment.
    user_id = current_user["id"]

    assets = await db["assets"].find({"user_id": user_id}, {"invoice_attachment_path": 1, "_id": 1}).to_list(length=10000)
    suggestions = await db["asset_suggestions"].find({"user_id": user_id}, {"invoice_attachment_path": 1}).to_list(length=10000)
    docs = await db["asset_documents"].find({"user_id": user_id}, {"file_path": 1}).to_list(length=10000)

    # Delete invoice files referenced by user assets/suggestions.
    invoice_paths: set[Path] = set()
    for item in assets:
        path_value = item.get("invoice_attachment_path")
        if isinstance(path_value, str) and path_value.strip():
            invoice_paths.add(Path(path_value))
    for item in suggestions:
        path_value = item.get("invoice_attachment_path")
        if isinstance(path_value, str) and path_value.strip():
            invoice_paths.add(Path(path_value))

    for file_path in invoice_paths:
        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)

    # Delete user-specific invoice directory.
    user_invoice_dir = INVOICE_ROOT / user_id
    if user_invoice_dir.exists() and user_invoice_dir.is_dir():
        shutil.rmtree(user_invoice_dir, ignore_errors=True)

    # Delete uploaded supporting documents owned by this user.
    for doc in docs:
        file_path_value = doc.get("file_path")
        if isinstance(file_path_value, str) and file_path_value.strip():
            file_path = Path(file_path_value)
            if file_path.exists() and file_path.is_file():
                file_path.unlink(missing_ok=True)

    asset_ids = [str(item.get("_id")) for item in assets if item.get("_id") is not None]

    await db["asset_documents"].delete_many({"user_id": user_id})
    await db["asset_suggestions"].delete_many({"user_id": user_id})
    await db["reminders"].delete_many({"user_id": user_id})
    await db["assets"].delete_many({"user_id": user_id})

    if asset_ids:
        await db["reminders"].delete_many({"asset_id": {"$in": asset_ids}, "user_id": user_id})

    return {
        "success": True,
        "message": "All assets, suggestions, reminders, and uploaded documents have been removed successfully. User login session remains active.",
    }
