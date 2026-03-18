from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
import base64
import mimetypes

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.security import get_current_user
from app.db.mongo import get_db
from app.schemas.gmail_import import SuggestionActionResponse, SuggestionEmailDetailsResponse, SuggestionParseResponse, SuggestionResponse
from app.services.asset_suggestion_service import AssetSuggestionService
from app.services.gmail_service import GmailService
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


def _decode_gmail_body(data: str | None) -> str:
    if not data:
        return ""
    padded = data + "=" * (-len(data) % 4)
    try:
        return base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _extract_header(headers: list[dict[str, Any]], header_name: str) -> str | None:
    target = header_name.lower()
    for header in headers:
        if str(header.get("name") or "").lower() == target:
            value = str(header.get("value") or "").strip()
            return value or None
    return None


def _extract_body_and_attachments(payload: dict[str, Any]) -> tuple[str | None, str | None, list[dict[str, Any]]]:
    plain_body: str | None = None
    html_body: str | None = None
    attachments: list[dict[str, Any]] = []

    stack: list[dict[str, Any]] = [payload]
    while stack:
        part = stack.pop()
        if not isinstance(part, dict):
            continue

        mime_type = str(part.get("mimeType") or "")
        body = part.get("body") if isinstance(part.get("body"), dict) else {}
        data = body.get("data") if isinstance(body, dict) else None

        if mime_type == "text/plain" and not plain_body:
            decoded = _decode_gmail_body(data if isinstance(data, str) else None)
            if decoded.strip():
                plain_body = decoded

        if mime_type == "text/html" and not html_body:
            decoded = _decode_gmail_body(data if isinstance(data, str) else None)
            if decoded.strip():
                html_body = decoded

        filename = str(part.get("filename") or "").strip()
        attachment_id = body.get("attachmentId") if isinstance(body, dict) else None
        if filename:
            attachments.append(
                {
                    "file_name": filename,
                    "mime_type": mime_type or None,
                    "size": int(body.get("size")) if isinstance(body.get("size"), int) else None,
                    "has_attachment_id": bool(attachment_id),
                }
            )

        parts = part.get("parts")
        if isinstance(parts, list):
            for child in parts:
                if isinstance(child, dict):
                    stack.append(child)

    return plain_body, html_body, attachments


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


@router.get("/{suggestion_id}/email", response_model=SuggestionEmailDetailsResponse)
async def get_suggestion_email_details(
    suggestion_id: str,
    current_user: dict[str, str] = Depends(get_current_user),
    db=Depends(get_db),
) -> SuggestionEmailDetailsResponse:
    try:
        object_id = ObjectId(suggestion_id)
    except Exception as error:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid suggestion id") from error

    item = await db["asset_suggestions"].find_one({"_id": object_id, "user_id": current_user["id"]})
    if not item:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    email_message_id = str(item.get("email_message_id") or "").strip()
    if not email_message_id:
        raise HTTPException(status_code=404, detail="Email message id not found for suggestion")

    gmail = GmailService(db)
    access_token = await gmail.get_valid_access_token(current_user["id"])
    message = await gmail.get_message(access_token, email_message_id)

    payload = message.get("payload") if isinstance(message.get("payload"), dict) else {}
    headers = payload.get("headers") if isinstance(payload.get("headers"), list) else []
    subject = _extract_header(headers, "Subject")
    sender = _extract_header(headers, "From")
    received_date_text = _extract_header(headers, "Date")
    received_date = _parse_datetime(received_date_text)
    email_body, email_body_html, attachments = _extract_body_and_attachments(payload)

    return SuggestionEmailDetailsResponse(
        subject=subject,
        sender=sender,
        received_date=received_date,
        email_body=email_body,
        email_body_html=email_body_html,
        attachments=attachments,
    )


@router.get("/{suggestion_id}/attachment")
async def suggestion_attachment(
    suggestion_id: str,
    download: bool = Query(False),
    current_user: dict[str, str] = Depends(get_current_user),
    db=Depends(get_db),
):
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

    file_name = str(item.get("attachment_filename") or path.name)
    explicit_mime = str(item.get("attachment_mime_type") or "").strip() or None
    guessed_mime, _ = mimetypes.guess_type(file_name)
    media_type = explicit_mime or guessed_mime or "application/octet-stream"
    disposition = "attachment" if download else "inline"
    safe_file_name = file_name.replace('"', "")

    return FileResponse(
        path,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{safe_file_name}"'},
    )
