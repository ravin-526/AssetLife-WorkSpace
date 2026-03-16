from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.core.security import get_current_user
from app.db.mongo import get_db
from app.schemas.gmail_import import SuggestionActionResponse, SuggestionParseResponse, SuggestionResponse
from app.services.asset_suggestion_service import AssetSuggestionService
from app.services.invoice_parser import InvoiceParserService

router = APIRouter(prefix="/api/assets/suggestions", tags=["Asset Suggestions"])


def _parse_datetime(value: object) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            parsed = parsedate_to_datetime(text)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except Exception:
            pass
        try:
            normalized = text.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(normalized)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except Exception:
            return None
    return None


def _to_suggestion(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("_id", "")),
        "product_name": item.get("product_name", "Unknown Asset"),
        "brand": item.get("brand"),
        "vendor": item.get("vendor"),
        "price": item.get("price"),
        "purchase_date": item.get("purchase_date"),
        "sender": item.get("sender"),
        "subject": item.get("subject"),
        "email_date": _parse_datetime(item.get("email_date")),
        "quantity": int(item.get("quantity", 1)),
        "source": item.get("source", "gmail"),
        "status": item.get("status", "pending"),
        "warranty": item.get("warranty"),
        "email_message_id": item.get("email_message_id", ""),
        "attachment_filename": item.get("attachment_filename"),
        "attachment_mime_type": item.get("attachment_mime_type"),
        "already_added": bool(item.get("already_added", False)),
        "created_at": item.get("created_at", datetime.now(timezone.utc).isoformat()),
        "invoice_attachment_path": item.get("invoice_attachment_path"),
    }


@router.get("", response_model=list[SuggestionResponse])
async def list_suggestions(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[SuggestionResponse]:
    service = AssetSuggestionService(db)
    items = await service.list_suggestions(current_user["id"])
    return [SuggestionResponse(**_to_suggestion(item)) for item in items]


@router.post("/clear-temp")
async def clear_temp_suggestions(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> dict[str, int]:
    service = AssetSuggestionService(db)
    deleted = await service.clear_temporary_after_flow(current_user["id"])
    return {"deleted": deleted}


@router.post("/{suggestion_id}/parse", response_model=SuggestionParseResponse)
async def parse_suggestion(suggestion_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> SuggestionParseResponse:
    try:
        object_id = ObjectId(suggestion_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid suggestion id") from error

    item = await db["asset_suggestions"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    attachment_path_value = item.get("invoice_attachment_path")
    if not attachment_path_value:
        return SuggestionParseResponse(
            suggestion_id=suggestion_id,
            status="parsed",
            message="No attachment available. Please review values manually.",
            product_name=item.get("product_name"),
            brand=item.get("brand"),
            vendor=item.get("vendor"),
            price=item.get("price"),
            purchase_date=item.get("purchase_date"),
            warranty=item.get("warranty"),
        )

    parser = InvoiceParserService()
    parsed = parser.parse_attachment(
        file_path=Path(str(attachment_path_value)),
        sender=item.get("sender"),
        subject=item.get("subject"),
        fallback_name=item.get("product_name"),
    )

    update_fields = {
        "product_name": parsed.get("product_name") or item.get("product_name"),
        "brand": parsed.get("brand") or item.get("brand"),
        "vendor": parsed.get("vendor") or item.get("vendor"),
        "price": parsed.get("price") if parsed.get("price") is not None else item.get("price"),
        "currency": parsed.get("currency") or item.get("currency") or "INR",
        "invoice_amount": parsed.get("invoice_amount") if parsed.get("invoice_amount") is not None else item.get("invoice_amount"),
        "invoice_currency": parsed.get("invoice_currency") or item.get("invoice_currency") or item.get("currency") or "INR",
        "exchange_rate": parsed.get("exchange_rate") if parsed.get("exchange_rate") is not None else item.get("exchange_rate"),
        "original_amount": parsed.get("original_amount") or item.get("original_amount"),
        "original_currency": parsed.get("original_currency") or item.get("original_currency"),
        "purchase_date": parsed.get("purchase_date") or item.get("purchase_date"),
        "invoice_number": parsed.get("invoice_number") or item.get("invoice_number"),
        "description": parsed.get("description") or item.get("description"),
        "warranty": parsed.get("warranty") or item.get("warranty"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db["asset_suggestions"].update_one({"_id": object_id}, {"$set": update_fields})

    return SuggestionParseResponse(
        suggestion_id=suggestion_id,
        status="parsed",
        message="Suggestion parsed",
        product_name=update_fields["product_name"],
        brand=update_fields["brand"],
        vendor=update_fields["vendor"],
        price=update_fields["price"],
        purchase_date=update_fields["purchase_date"],
        warranty=update_fields["warranty"],
    )


@router.post("/{suggestion_id}/reject", response_model=SuggestionActionResponse)
async def reject_suggestion(suggestion_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> SuggestionActionResponse:
    try:
        object_id = ObjectId(suggestion_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid suggestion id") from error

    await db["asset_suggestions"].update_one(
        {"_id": object_id, "user_id": current_user["id"]},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return SuggestionActionResponse(suggestion_id=suggestion_id, status="rejected")


@router.post("/{suggestion_id}/confirm", response_model=SuggestionActionResponse)
async def confirm_suggestion(suggestion_id: str, payload: dict[str, Any], current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> SuggestionActionResponse:
    try:
        object_id = ObjectId(suggestion_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid suggestion id") from error

    item = await db["asset_suggestions"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    asset = {
        "user_id": current_user["id"],
        "name": payload.get("product_name") or item.get("product_name") or "Unnamed Asset",
        "brand": payload.get("brand") or item.get("brand"),
        "vendor": payload.get("vendor") or item.get("vendor"),
        "price": payload.get("price") if payload.get("price") is not None else item.get("price"),
        "description": payload.get("description") or item.get("description"),
        "purchase_date": payload.get("purchase_date") or item.get("purchase_date"),
        "category": payload.get("category") or "Other",
        "subcategory": payload.get("subcategory") or "Custom Asset",
        "source": "gmail",
        "source_email_id": item.get("email_message_id"),
        "invoice_attachment_path": item.get("invoice_attachment_path"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = await db["assets"].insert_one(asset)
    await db["asset_suggestions"].update_one(
        {"_id": object_id},
        {"$set": {"status": "confirmed", "already_added": True, "asset_id": str(result.inserted_id), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    return SuggestionActionResponse(suggestion_id=suggestion_id, status="confirmed", asset_id=str(result.inserted_id))


@router.get("/{suggestion_id}/attachment")
async def suggestion_attachment(suggestion_id: str, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)):
    try:
        object_id = ObjectId(suggestion_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid suggestion id") from error

    item = await db["asset_suggestions"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    path_value = item.get("invoice_attachment_path")
    if not path_value:
        raise HTTPException(status_code=404, detail="Attachment not found")

    path = Path(str(path_value))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found")

    return FileResponse(path, media_type=item.get("attachment_mime_type") or "application/octet-stream", filename=item.get("attachment_filename") or path.name)
