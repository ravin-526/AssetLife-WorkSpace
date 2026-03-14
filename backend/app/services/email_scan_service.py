from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.logger import app_logger
from app.services.asset_suggestion_service import AssetSuggestionService
from app.services.gmail_service import GmailService
from app.services.invoice_parser import InvoiceParserService


class EmailScanService:
    DEFAULT_SCAN_DAYS = 10
    MAX_SYNC_RESULTS = 500
    INVOICE_KEYWORDS = {
        "invoice",
        "tax invoice",
        "receipt",
        "purchase invoice",
        "payment receipt",
        "bill",
        "order invoice",
    }
    NON_ASSET_VENDORS = {
        "uber",
        "ola",
        "rapido",
        "zomato",
        "swiggy",
        "foodpanda",
        "food panda",
        "dominos",
        "mcdonalds",
        "dtdc",
        "blue dart",
        "bluedart",
        "delhivery",
        "xpressbees",
        "shadowfax",
        "ekart",
        "ecom express",
        "india post",
        "fedex",
        "dhl",
        "courier",
    }
    ALLOWED_ATTACHMENT_MIME = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    ALLOWED_ATTACHMENT_EXT = (".pdf", ".jpg", ".jpeg", ".png", ".xls", ".xlsx")
    INVOICE_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "invoices"

    @staticmethod
    def _safe_filename(name: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "invoice")
        return cleaned[:180] or "invoice"

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.gmail = GmailService(db)
        self.parser = InvoiceParserService()
        self.suggestions = AssetSuggestionService(db)
        self.scans = db["email_scans"]

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _extract_sender_subject(headers: list[dict[str, Any]] | None) -> tuple[str, str]:
        header_list = headers or []
        sender = next((str(h.get("value")) for h in header_list if str(h.get("name", "")).lower() == "from"), "")
        subject = next((str(h.get("value")) for h in header_list if str(h.get("name", "")).lower() == "subject"), "")
        return sender, subject

    def _is_allowed_attachment(self, filename: str, mime_type: str) -> bool:
        lowered_name = (filename or "").lower()
        lowered_mime = (mime_type or "").lower()
        return lowered_mime in self.ALLOWED_ATTACHMENT_MIME or lowered_name.endswith(self.ALLOWED_ATTACHMENT_EXT)

    @staticmethod
    def _attachment_extension(filename: str, mime_type: str) -> str:
        lowered_name = (filename or "").lower()
        lowered_mime = (mime_type or "").lower()
        if lowered_name.endswith(".pdf") or lowered_mime == "application/pdf":
            return ".pdf"
        if lowered_name.endswith((".jpg", ".jpeg")) or lowered_mime == "image/jpeg":
            return ".jpg"
        if lowered_name.endswith(".png") or lowered_mime == "image/png":
            return ".png"
        if lowered_name.endswith(".xlsx") or lowered_mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return ".xlsx"
        if lowered_name.endswith(".xls") or lowered_mime == "application/vnd.ms-excel":
            return ".xls"
        return ".bin"

    def _is_probable_invoice(self, subject: str, attachment_names: list[str]) -> bool:
        subject_lower = (subject or "").lower()
        subject_match = any(keyword in subject_lower for keyword in self.INVOICE_KEYWORDS)
        attachment_match = any(any(keyword in (name or "").lower() for keyword in self.INVOICE_KEYWORDS) for name in attachment_names)
        return subject_match or attachment_match

    @staticmethod
    def _normalize_filters(values: list[str] | None) -> list[str]:
        if not values:
            return []
        return [v.strip().lower() for v in values if str(v).strip()]

    @staticmethod
    def _sender_matches_filter(sender: str, sender_filters: list[str]) -> bool:
        if not sender_filters:
            return True
        sender_lower = (sender or "").lower()
        return any(token in sender_lower for token in sender_filters)

    @staticmethod
    def _subject_matches_keywords(subject: str, keywords: list[str]) -> bool:
        subject_lower = (subject or "").lower()
        if not keywords:
            return False
        return any(keyword in subject_lower for keyword in keywords)

    def _is_non_asset_vendor(self, sender: str) -> bool:
        sender_lower = (sender or "").lower()
        return any(vendor in sender_lower for vendor in self.NON_ASSET_VENDORS)

    async def ensure_indexes(self) -> None:
        self.INVOICE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        await self.db["gmail_integrations"].create_index([("user_id", 1), ("provider", 1)], unique=True)
        await self.db["email_scans"].create_index([("user_id", 1), ("gmail_message_id", 1)], unique=True)
        await self.db["asset_suggestions"].create_index([("user_id", 1), ("status", 1)])
        await self.db["asset_suggestions"].create_index([("email_message_id", 1)])

    @staticmethod
    def _normalize_user_id(user_id: str) -> ObjectId | str:
        try:
            return ObjectId(user_id)
        except InvalidId:
            return user_id

    async def list_scans(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        cursor = self.scans.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        records: list[dict[str, Any]] = []
        async for document in cursor:
            document["id"] = str(document.get("_id"))
            document.pop("_id", None)
            document.setdefault("sender", "")
            document.setdefault("subject", "")
            records.append(document)
        return records

    async def get_scan(self, user_id: str, scan_id: str) -> dict[str, Any] | None:
        try:
            object_id = ObjectId(scan_id)
        except InvalidId:
            return None

        doc = await self.scans.find_one({"_id": object_id, "user_id": user_id})
        if not doc:
            return None

        doc["id"] = str(doc.get("_id"))
        doc.pop("_id", None)
        doc.setdefault("sender", "")
        doc.setdefault("subject", "")
        return doc

    async def sync_recent_emails(
        self,
        user_id: str,
        days: int = DEFAULT_SCAN_DAYS,
        max_results: int = 100,
        subject_keywords: list[str] | None = None,
        sender_addresses: list[str] | None = None,
    ) -> dict[str, Any]:
        access_token = await self.gmail.get_valid_access_token(user_id)
        capped_max_results = min(max_results, self.MAX_SYNC_RESULTS)
        scan_days = max(1, min(int(days), 90))
        gmail_query = f"newer_than:{scan_days}d has:attachment"
        normalized_subject_keywords = self._normalize_filters(subject_keywords)
        subject_filters = normalized_subject_keywords or [k.lower() for k in self.INVOICE_KEYWORDS]
        sender_filters = self._normalize_filters(sender_addresses)

        app_logger.info("Scanning emails", extra={"user_id": user_id, "days": scan_days, "query": gmail_query})
        message_ids = await self.gmail.search_messages(access_token, gmail_query, max_results=capped_max_results)

        invoice_emails_detected = 0
        scanned = 0
        created_suggestions = 0
        skipped_duplicates = 0
        attachments_detected = 0
        attachments_downloaded = 0
        attachments_processed = 0

        # Keep suggestion data temporary per sync run.
        await self.suggestions.clear_temporary_suggestions(user_id)
        await self.scans.delete_many({"user_id": user_id})

        for message_id in message_ids:
            sender = ""
            subject = ""

            try:
                message = await self.gmail.get_message(access_token, message_id)
                payload = message.get("payload", {})
                payload_headers = payload.get("headers", [])
                sender, subject = self._extract_sender_subject(payload_headers)

                parsed_items, attachments, metadata = self.parser.parse_message(message_id, payload)
                filtered_attachments = [a for a in attachments if self._is_allowed_attachment(a.filename, a.mime_type)]
                attachments_detected += len(filtered_attachments)

                sender = str(metadata.get("sender") or sender or "")
                subject = str(metadata.get("subject") or subject or "")

                if not self._sender_matches_filter(sender, sender_filters):
                    continue
                if self._is_non_asset_vendor(sender):
                    continue

                probable_invoice = self._subject_matches_keywords(subject, subject_filters) or self._is_probable_invoice(subject, [a.filename for a in filtered_attachments])
                if not probable_invoice or not filtered_attachments:
                    continue

                invoice_emails_detected += 1

                primary_attachment = filtered_attachments[0] if filtered_attachments else None
                attachment_file_path: str | None = None

                if primary_attachment:
                    attachment_bytes = await self.gmail.get_attachment_data(access_token, message_id, primary_attachment.attachment_id)
                    if attachment_bytes:
                        extension = self._attachment_extension(primary_attachment.filename, primary_attachment.mime_type)
                        user_folder = self.INVOICE_UPLOAD_DIR / user_id
                        user_folder.mkdir(parents=True, exist_ok=True)
                        safe_name = self._safe_filename(primary_attachment.filename)
                        destination = user_folder / f"{message_id}_{safe_name}"
                        if destination.suffix.lower() != extension:
                            destination = destination.with_suffix(extension)
                        destination.write_bytes(attachment_bytes)
                        attachment_file_path = str(destination)
                        attachments_downloaded += 1

                for item in parsed_items:
                    item["sender"] = sender
                    item["subject"] = subject
                    item["email_date"] = metadata.get("email_date")
                    item["source_email_id"] = message_id
                    if primary_attachment:
                        item["attachment_id"] = primary_attachment.attachment_id
                        item["attachment_filename"] = primary_attachment.filename
                        item["attachment_mime_type"] = primary_attachment.mime_type
                    if attachment_file_path:
                        item["invoice_attachment_path"] = attachment_file_path
                        attachments_processed += 1

                    already_added = await self.suggestions.is_already_added(user_id, item)
                    if already_added:
                        skipped_duplicates += 1

                    created_suggestions += await self.suggestions.create_suggestions(user_id, item, already_added=already_added)
            except Exception as error:
                app_logger.exception("Email scan failed", exc_info=error)
            finally:
                scanned += 1

        await self.db["gmail_integrations"].update_one(
            {"user_id": self._normalize_user_id(user_id), "provider": "gmail"},
            {"$set": {"last_sync_at": self._now(), "updated_at": self._now()}},
        )

        integration = await self.db["gmail_integrations"].find_one(
            {"user_id": self._normalize_user_id(user_id), "provider": "gmail"},
            {"assets_added_by_user": 1},
        )
        assets_added_by_user = int((integration or {}).get("assets_added_by_user", 0) or 0)
        pending_suggestions = await self.suggestions.list_suggestions(user_id, status="pending")

        return {
            "sync_status": "completed",
            "scanned": scanned,
            "emails_scanned": scanned,
            "purchase_emails_detected": invoice_emails_detected,
            "invoice_emails": invoice_emails_detected,
            "attachments_detected": attachments_detected,
            "attachments_found": attachments_detected,
            "attachments_downloaded": attachments_downloaded,
            "attachments_processed": attachments_processed,
            "created_suggestions": created_suggestions,
            "assets_detected": created_suggestions,
            "skipped_duplicates": skipped_duplicates,
            "assets_added_by_user": assets_added_by_user,
            "suggestions": pending_suggestions,
        }
