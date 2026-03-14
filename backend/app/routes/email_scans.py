import os
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.logger import app_logger
from app.core.security import get_current_user
from app.db.mongo import get_db
from app.schemas.gmail_import import EmailScanResponse, GmailSyncRequest, GmailSyncResponse
from app.services.email_scan_service import EmailScanService
from app.services.gmail_service import GmailService

router = APIRouter(tags=["Email Scans"])


def _cors_headers() -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
    }


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


def _normalize_suggestion(raw: dict[str, object]) -> dict[str, object]:
    suggestion_id = str(raw.get("id") or raw.get("_id") or uuid4())
    created_at = _parse_datetime(raw.get("created_at")) or datetime.now(timezone.utc)

    normalized: dict[str, object] = {
        "id": suggestion_id,
        "product_name": str(raw.get("product_name") or "Unknown Asset"),
        "brand": raw.get("brand"),
        "vendor": raw.get("vendor"),
        "price": raw.get("price"),
        "purchase_date": _parse_datetime(raw.get("purchase_date")),
        "sender": raw.get("sender"),
        "subject": raw.get("subject"),
        "email_date": _parse_datetime(raw.get("email_date")),
        "quantity": int(raw.get("quantity") or 1),
        "source": str(raw.get("source") or "gmail"),
        "status": str(raw.get("status") or "pending"),
        "warranty": raw.get("warranty"),
        "email_message_id": str(raw.get("email_message_id") or raw.get("source_email_id") or f"generated-{suggestion_id}"),
        "attachment_filename": raw.get("attachment_filename"),
        "attachment_mime_type": raw.get("attachment_mime_type"),
        "action_options": ["add", "skip"],
        "already_added": bool(raw.get("already_added", False)),
        "created_at": created_at,
    }
    return normalized


@router.get("/api/emails", response_model=list[EmailScanResponse])
async def list_email_scans(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[EmailScanResponse]:
    service = EmailScanService(db)
    records = await service.list_scans(current_user["id"])
    return [EmailScanResponse(**record) for record in records]


@router.post("/api/email/scan", response_model=GmailSyncResponse)
async def run_email_scan(payload: GmailSyncRequest, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailSyncResponse:
    try:
        if not current_user or not current_user.get("id"):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"status": "error", "message": "Unauthorized. Please login again."},
                headers=_cors_headers(),
            )

        google_client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
        google_client_secret = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
        google_redirect_uri = (os.environ.get("GOOGLE_REDIRECT_URI") or "").strip()
        missing = [
            name
            for name, value in (
                ("GOOGLE_CLIENT_ID", google_client_id),
                ("GOOGLE_CLIENT_SECRET", google_client_secret),
                ("GOOGLE_REDIRECT_URI", google_redirect_uri),
            )
            if not value
        ]
        if missing:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "error",
                    "message": "Missing required Gmail OAuth environment variables",
                    "missing": missing,
                },
                headers=_cors_headers(),
            )

        gmail_service = GmailService(db)
        mailbox_status = await gmail_service.get_connection_status(current_user["id"])
        configured_email = str(mailbox_status.get("email_address") or "").strip().lower()
        if not configured_email:
            request_email = str(payload.email or "").strip().lower()
            if not request_email:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": "error",
                        "message": "No mailbox email is configured in profile. Please provide email to continue.",
                        "needs_email": True,
                    },
                    headers=_cors_headers(),
                )
            if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", request_email):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": "error",
                        "message": "Provided email is invalid.",
                        "needs_email": True,
                    },
                    headers=_cors_headers(),
                )
            configured_email = await gmail_service.set_profile_email(current_user["id"], request_email)
            mailbox_status = await gmail_service.get_connection_status(current_user["id"])

        if not bool(mailbox_status.get("connected")):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": "error",
                    "message": "Mailbox is not connected. Please connect before syncing emails.",
                },
                headers=_cors_headers(),
            )

        service = EmailScanService(db)
        await service.ensure_indexes()
        result = await service.sync_recent_emails(
            user_id=current_user["id"],
            days=payload.days,
            max_results=payload.max_results,
            subject_keywords=payload.subject_keywords,
            sender_addresses=payload.sender_addresses,
        )

        raw_suggestions = result.get("suggestions") if isinstance(result.get("suggestions"), list) else []
        validated_suggestions = []
        failed_suggestions: list[dict[str, object]] = []

        for index, item in enumerate(raw_suggestions):
            if not isinstance(item, dict):
                failed_suggestions.append({"index": index, "reason": "Suggestion item is not an object"})
                continue
            try:
                normalized = _normalize_suggestion(item)
                validated_suggestions.append(normalized)
            except Exception as item_error:
                failed_suggestions.append(
                    {
                        "index": index,
                        "id": str(item.get("id") or item.get("_id") or ""),
                        "reason": str(item_error),
                    }
                )

        if failed_suggestions:
            app_logger.warning(
                "Email scan response validation failed for some suggestions",
                extra={
                    "user_id": current_user["id"],
                    "emails_scanned": result.get("emails_scanned", result.get("scanned", 0)),
                    "created_suggestions": result.get("created_suggestions", 0),
                    "failed_count": len(failed_suggestions),
                    "failed_items": failed_suggestions,
                },
            )
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "status": "error",
                    "message": "Some suggestions failed validation",
                    "failed_items": failed_suggestions,
                    "emails_scanned": result.get("emails_scanned", result.get("scanned", 0)),
                    "purchase_emails_detected": result.get("purchase_emails_detected", 0),
                    "created_suggestions": result.get("created_suggestions", 0),
                },
                headers=_cors_headers(),
            )

        result["suggestions"] = validated_suggestions

        response = GmailSyncResponse(**result)
        app_logger.info(
            "Email scan completed",
            extra={
                "user_id": current_user["id"],
                "emails_scanned": response.emails_scanned or response.scanned,
                "purchase_emails_detected": response.purchase_emails_detected,
                "created_suggestions": response.created_suggestions,
                "failed_count": 0,
            },
        )
        return response
    except ValidationError as error:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"status": "error", "message": "Invalid scan response", "details": error.errors()},
            headers=_cors_headers(),
        )
    except HTTPException as error:
        return JSONResponse(
            status_code=error.status_code,
            content={"status": "error", "message": str(error.detail)},
            headers=_cors_headers(),
        )
    except Exception as error:
        app_logger.exception("Email scan route failed", exc_info=error)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"status": "error", "message": "Failed to scan mailbox emails"},
            headers=_cors_headers(),
        )
