from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/assets", tags=["Assets"])

UPLOAD_ROOT = Path("backend/uploads")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
DOC_ROOT = UPLOAD_ROOT / "documents"
DOC_ROOT.mkdir(parents=True, exist_ok=True)


def _to_asset(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("_id", "")),
        "name": item.get("name", ""),
        "asset_name": item.get("asset_name") or item.get("name"),
        "vendor": item.get("vendor"),
        "purchase_date": item.get("purchase_date"),
        "price": item.get("price"),
        "source": item.get("source", "manual"),
        "user_id": item.get("user_id", ""),
        "brand": item.get("brand"),
        "category": item.get("category"),
        "subcategory": item.get("subcategory"),
        "serial_number": item.get("serial_number"),
        "model_number": item.get("model_number"),
        "invoice_number": item.get("invoice_number"),
        "description": item.get("description"),
        "notes": item.get("notes"),
        "location": item.get("location"),
        "assigned_user": item.get("assigned_user"),
        "warranty": item.get("warranty"),
        "insurance": item.get("insurance"),
        "service": item.get("service"),
        "source_email_id": item.get("source_email_id"),
        "source_email_sender": item.get("source_email_sender"),
        "source_email_subject": item.get("source_email_subject"),
        "invoice_attachment_path": item.get("invoice_attachment_path"),
        "auto_reminders_created": item.get("auto_reminders_created", 0),
        "created_at": item.get("created_at"),
        "updated_at": item.get("updated_at"),
    }


def _to_document(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "document_id": str(item.get("_id", "")),
        "file_name": item.get("file_name", "document"),
        "document_type": item.get("document_type", "supporting"),
        "file_url": f"/api/assets/{item.get('asset_id')}/documents/{item.get('_id')}/file",
        "uploaded_at": item.get("uploaded_at", datetime.now(timezone.utc).isoformat()),
    }


def _text(value: Any) -> str:
    return str(value or "").strip()


def _normalized_lower(value: Any) -> str:
    return _text(value).lower()


def _lifecycle_payload(payload: dict[str, Any]) -> dict[str, Any] | None:
    lifecycle = payload.get("lifecycle_info")
    if isinstance(lifecycle, dict):
        return lifecycle
    return None


async def _create_reminders_for_lifecycle(
    asset_id: str,
    asset_name: str,
    lifecycle_info: dict[str, Any] | None,
    user_id: str,
    db,
) -> int:
    if not lifecycle_info:
        return 0

    reminders: list[dict[str, Any]] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    warranty = lifecycle_info.get("warranty")
    if isinstance(warranty, dict) and warranty.get("available") and warranty.get("end_date"):
        reminders.append(
            {
                "user_id": user_id,
                "title": f"Warranty expiry for {asset_name}",
                "asset_id": asset_id,
                "asset_name": asset_name,
                "reminder_date": str(warranty["end_date"]),
                "reminder_type": "warranty",
                "status": "active",
                "notes": warranty.get("notes"),
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )

    insurance = lifecycle_info.get("insurance")
    if isinstance(insurance, dict) and insurance.get("available") and insurance.get("expiry_date"):
        reminders.append(
            {
                "user_id": user_id,
                "title": f"Insurance renewal for {asset_name}",
                "asset_id": asset_id,
                "asset_name": asset_name,
                "reminder_date": str(insurance["expiry_date"]),
                "reminder_type": "custom",
                "status": "active",
                "notes": insurance.get("coverage_notes") or insurance.get("notes"),
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )

    service = lifecycle_info.get("service")
    if isinstance(service, dict) and service.get("required"):
        interval_days = int(service.get("custom_interval_days") or 0)
        if interval_days <= 0:
            frequency = str(service.get("frequency") or "monthly")
            mapping = {"monthly": 30, "quarterly": 90, "half_yearly": 180, "yearly": 365}
            interval_days = mapping.get(frequency, 30)

        reminder_date = (datetime.now(timezone.utc) + timedelta(days=interval_days)).date().isoformat()
        reminders.append(
            {
                "user_id": user_id,
                "title": f"Service reminder for {asset_name}",
                "asset_id": asset_id,
                "asset_name": asset_name,
                "reminder_date": reminder_date,
                "reminder_type": "service",
                "status": "active",
                "notes": "Auto-generated from asset service settings",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
        )

    if reminders:
        await db["reminders"].insert_many(reminders)

    return len(reminders)


async def _find_duplicate_asset(payload: dict[str, Any], user_id: str, db) -> dict[str, Any] | None:
    invoice_number = _text(payload.get("invoice_number"))
    if invoice_number:
        duplicate = await db["assets"].find_one(
            {
                "user_id": user_id,
                "invoice_number": {"$regex": f"^{invoice_number}$", "$options": "i"},
            }
        )
        if duplicate:
            return duplicate

    name = _text(payload.get("name") or payload.get("product_name"))
    vendor = _text(payload.get("vendor"))
    purchase_date = _text(payload.get("purchase_date"))
    source_email_id = _text(payload.get("source_email_id"))

    if source_email_id:
        duplicate = await db["assets"].find_one({"user_id": user_id, "source_email_id": source_email_id})
        if duplicate:
            return duplicate

    if name and vendor and purchase_date:
        duplicate = await db["assets"].find_one(
            {
                "user_id": user_id,
                "name_normalized": _normalized_lower(name),
                "vendor_normalized": _normalized_lower(vendor),
                "purchase_date": purchase_date,
            }
        )
        if duplicate:
            return duplicate

    return None


@router.get("")
async def list_assets(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    items = await db["assets"].find({"user_id": current_user["id"]}).sort("created_at", -1).to_list(length=2000)
    return [_to_asset(item) for item in items]


@router.post("")
async def create_asset(payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    category = _text(payload.get("category"))
    subcategory = _text(payload.get("subcategory"))
    if not category:
        raise HTTPException(status_code=400, detail="Category is required")
    if not subcategory:
        raise HTTPException(status_code=400, detail="SubCategory is required")

    duplicate = await _find_duplicate_asset(payload, current_user["id"], db)
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Duplicate asset detected",
                "existing_asset_id": str(duplicate.get("_id", "")),
                "name": duplicate.get("name"),
                "invoice_number": duplicate.get("invoice_number"),
            },
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    name = _text(payload.get("name") or payload.get("product_name")) or "Unnamed Asset"
    lifecycle_info = _lifecycle_payload(payload)
    document = {
        "user_id": current_user["id"],
        "name": name,
        "name_normalized": _normalized_lower(name),
        "asset_name": name,
        "brand": payload.get("brand"),
        "category": category,
        "subcategory": subcategory,
        "vendor": payload.get("vendor"),
        "vendor_normalized": _normalized_lower(payload.get("vendor")),
        "purchase_date": payload.get("purchase_date"),
        "price": payload.get("price"),
        "serial_number": payload.get("serial_number"),
        "model_number": payload.get("model_number"),
        "invoice_number": _text(payload.get("invoice_number")) or None,
        "description": payload.get("description"),
        "notes": payload.get("notes"),
        "location": payload.get("location"),
        "assigned_user": payload.get("assigned_user"),
        "warranty": lifecycle_info.get("warranty") if lifecycle_info else None,
        "insurance": lifecycle_info.get("insurance") if lifecycle_info else None,
        "service": lifecycle_info.get("service") if lifecycle_info else None,
        "source": payload.get("source") or "manual",
        "source_email_id": payload.get("source_email_id"),
        "source_email_sender": payload.get("source_email_sender"),
        "source_email_subject": payload.get("source_email_subject"),
        "invoice_attachment_path": payload.get("invoice_attachment_path"),
        "auto_reminders_created": 0,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    result = await db["assets"].insert_one(document)
    asset_id = str(result.inserted_id)

    suggestion_id = payload.get("suggestion_id")
    if suggestion_id:
        try:
            object_id = ObjectId(str(suggestion_id))
            await db["asset_suggestions"].update_one(
                {"_id": object_id, "user_id": current_user["id"]},
                {"$set": {"already_added": True, "status": "confirmed", "asset_id": asset_id, "updated_at": now_iso}},
            )
        except Exception:
            pass

    reminder_count = await _create_reminders_for_lifecycle(asset_id, name, lifecycle_info, current_user["id"], db)
    if reminder_count:
        await db["assets"].update_one({"_id": ObjectId(asset_id)}, {"$set": {"auto_reminders_created": reminder_count}})

    created = await db["assets"].find_one({"_id": ObjectId(asset_id)})
    return _to_asset(created or document)


@router.get("/{asset_id}")
async def get_asset(asset_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    try:
        object_id = ObjectId(asset_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid asset id") from error

    item = await db["assets"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _to_asset(item)


@router.put("/{asset_id}")
async def update_asset(asset_id: str, payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    try:
        object_id = ObjectId(asset_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid asset id") from error

    lifecycle_info = _lifecycle_payload(payload)
    allowed = {
        "name",
        "asset_name",
        "brand",
        "vendor",
        "purchase_date",
        "price",
        "category",
        "subcategory",
        "serial_number",
        "model_number",
        "invoice_number",
        "description",
        "notes",
        "location",
        "assigned_user",
        "warranty",
        "insurance",
        "service",
        "source",
    }
    update_data = {key: value for key, value in payload.items() if key in allowed}

    if "name" in update_data:
        update_data["name_normalized"] = _normalized_lower(update_data.get("name"))
    if "vendor" in update_data:
        update_data["vendor_normalized"] = _normalized_lower(update_data.get("vendor"))

    if lifecycle_info:
        update_data["warranty"] = lifecycle_info.get("warranty")
        update_data["insurance"] = lifecycle_info.get("insurance")
        update_data["service"] = lifecycle_info.get("service")

    category = update_data.get("category")
    if category is not None and not _text(category):
        raise HTTPException(status_code=400, detail="Category cannot be empty")

    subcategory = update_data.get("subcategory")
    if subcategory is not None and not _text(subcategory):
        raise HTTPException(status_code=400, detail="SubCategory cannot be empty")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db["assets"].update_one({"_id": object_id, "user_id": current_user["id"]}, {"$set": update_data})
    item = await db["assets"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")
    return _to_asset(item)


@router.delete("/{asset_id}")
async def delete_asset(asset_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, str]:
    try:
        object_id = ObjectId(asset_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid asset id") from error

    docs = await db["asset_documents"].find({"asset_id": asset_id, "user_id": current_user["id"]}).to_list(length=300)
    for doc in docs:
        path = Path(str(doc.get("file_path", "")))
        if path.exists():
            path.unlink(missing_ok=True)

    await db["asset_documents"].delete_many({"asset_id": asset_id, "user_id": current_user["id"]})
    await db["reminders"].delete_many({"asset_id": asset_id, "user_id": current_user["id"]})
    await db["assets"].delete_one({"_id": object_id, "user_id": current_user["id"]})
    return {"status": "deleted", "asset_id": asset_id}


@router.get("/{asset_id}/invoice")
async def get_asset_invoice(asset_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)):
    try:
        object_id = ObjectId(asset_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid asset id") from error

    item = await db["assets"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Asset not found")

    invoice_path = item.get("invoice_attachment_path")
    if not invoice_path:
        raise HTTPException(status_code=404, detail="Invoice not available")

    path = Path(str(invoice_path))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Invoice file not found")

    return FileResponse(path, media_type="application/pdf", filename=path.name)


@router.post("/{asset_id}/documents")
async def upload_documents(asset_id: str, files: list[UploadFile] = File(...), current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, Any]:
    try:
        object_id = ObjectId(asset_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid asset id") from error

    asset = await db["assets"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    saved_docs: list[dict[str, Any]] = []
    for upload in files:
        safe_name = upload.filename or "document"
        file_name = f"{asset_id}_{datetime.now(timezone.utc).timestamp()}_{safe_name}"
        file_path = DOC_ROOT / file_name
        content = await upload.read()
        file_path.write_bytes(content)

        doc = {
            "asset_id": asset_id,
            "user_id": current_user["id"],
            "file_name": safe_name,
            "document_type": "supporting",
            "file_path": str(file_path),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db["asset_documents"].insert_one(doc)
        doc["_id"] = result.inserted_id
        saved_docs.append(_to_document(doc))

    return {"asset_id": asset_id, "uploaded": saved_docs}


@router.get("/{asset_id}/documents")
async def list_documents(asset_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    docs = await db["asset_documents"].find(
        {"asset_id": asset_id, "user_id": current_user["id"], "document_type": "supporting"}
    ).sort("uploaded_at", -1).to_list(length=300)
    return [_to_document(doc) for doc in docs]


@router.get("/{asset_id}/documents/{document_id}/file")
async def get_document_file(asset_id: str, document_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)):
    try:
        object_id = ObjectId(document_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid document id") from error

    doc = await db["asset_documents"].find_one({"_id": object_id, "asset_id": asset_id, "user_id": current_user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    path = Path(str(doc.get("file_path", "")))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")

    return FileResponse(path, media_type="application/octet-stream", filename=doc.get("file_name") or path.name)


@router.delete("/{asset_id}/documents/{document_id}")
async def delete_document(asset_id: str, document_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, str]:
    try:
        object_id = ObjectId(document_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid document id") from error

    doc = await db["asset_documents"].find_one({"_id": object_id, "asset_id": asset_id, "user_id": current_user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    path = Path(str(doc.get("file_path", "")))
    if path.exists():
        path.unlink(missing_ok=True)

    await db["asset_documents"].delete_one({"_id": object_id})
    return {"status": "deleted", "document_id": document_id}
