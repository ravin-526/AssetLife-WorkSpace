from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re
import tempfile
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
    }
    ALLOWED_ATTACHMENT_EXT = (".pdf", ".jpg", ".jpeg", ".png")
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

    @staticmethod
    def _subject_fallback_name(subject: str, message_id: str) -> str:
        cleaned = re.sub(r"\b(invoice|receipt|tax|order|payment|bill)\b", "", subject or "", flags=re.IGNORECASE)
        cleaned = re.sub(r"[^a-zA-Z0-9\s-]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -_")
        if cleaned:
            return cleaned[:120]
        return f"Detected Asset {message_id[-6:]}"

    @staticmethod
    def _sender_fallback_vendor(sender: str) -> str | None:
        raw = (sender or "").strip().strip('"')
        if not raw:
            return None
        if "<" in raw:
            return raw.split("<", 1)[0].strip() or None
        if "@" in raw:
            domain = raw.split("@", 1)[1]
            return domain.split(".", 1)[0].replace("-", " ").title()
        return raw

    def _ensure_minimum_suggestion_payload(self, item: dict[str, Any], *, sender: str, subject: str, message_id: str) -> None:
        product_name = str(item.get("product_name") or "").strip()
        invoice_number = str(item.get("invoice_number") or "").strip()
        price = item.get("price")

        if not product_name:
            item["product_name"] = self._subject_fallback_name(subject, message_id)
        if not item.get("vendor"):
            item["vendor"] = self._sender_fallback_vendor(sender)

        # Last-resort fallback if parser yielded almost no data.
        if not (str(item.get("product_name") or "").strip() or price is not None or invoice_number):
            item["product_name"] = self._subject_fallback_name(subject, message_id)

    @staticmethod
    def _log_parsed_fields(message_id: str, item: dict[str, Any]) -> None:
        app_logger.info(
            "Parsed invoice fields",
            extra={
                "message_id": message_id,
                "parsed_product_name": str(item.get("product_name") or ""),
                "parsed_price": item.get("price"),
                "parsed_purchase_date": item.get("purchase_date"),
                "parsed_invoice_number": str(item.get("invoice_number") or ""),
            },
        )

    @staticmethod
    def _merge_parsed_fields(item: dict[str, Any], parsed_details: dict[str, Any]) -> None:
        if not item.get("product_name") and parsed_details.get("product_name"):
            item["product_name"] = parsed_details["product_name"]
        if item.get("price") is None and parsed_details.get("price") is not None:
            item["price"] = parsed_details["price"]
            item["currency"] = parsed_details.get("currency") or item.get("currency") or "INR"
            item["invoice_amount"] = parsed_details.get("invoice_amount")
            item["invoice_currency"] = parsed_details.get("invoice_currency") or item.get("currency") or "INR"
            item["exchange_rate"] = parsed_details.get("exchange_rate")
            item["original_amount"] = parsed_details.get("original_amount")
            item["original_currency"] = parsed_details.get("original_currency")
        else:
            if item.get("invoice_amount") is None and parsed_details.get("invoice_amount") is not None:
                item["invoice_amount"] = parsed_details.get("invoice_amount")
            if not item.get("invoice_currency") and parsed_details.get("invoice_currency"):
                item["invoice_currency"] = parsed_details.get("invoice_currency")
            if item.get("exchange_rate") is None and parsed_details.get("exchange_rate") is not None:
                item["exchange_rate"] = parsed_details.get("exchange_rate")
        if not item.get("purchase_date") and parsed_details.get("purchase_date"):
            item["purchase_date"] = parsed_details["purchase_date"]
        if not item.get("invoice_number") and parsed_details.get("invoice_number"):
            item["invoice_number"] = parsed_details["invoice_number"]
        if parsed_details.get("description"):
            item["description"] = parsed_details["description"]

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
        exclude_service_receipts: bool = True,
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
        service_receipts_skipped = 0

        # Keep suggestion data temporary per sync run.
        await self.suggestions.clear_temporary_suggestions(user_id)
        await self.scans.delete_many({"user_id": user_id})

        for message_id in message_ids:
            sender = ""
            subject = ""

            try:
                app_logger.info("Processing email", extra={"message_id": message_id})
                message = await self.gmail.get_message(access_token, message_id)
                payload = message.get("payload", {})
                payload_headers = payload.get("headers", [])
                sender, subject = self._extract_sender_subject(payload_headers)

                parsed_items, attachments, metadata = self.parser.parse_message(message_id, payload)
                filtered_attachments = [a for a in attachments if self._is_allowed_attachment(a.filename, a.mime_type)]
                attachments_detected += len(filtered_attachments)

                for attachment in filtered_attachments:
                    app_logger.info(
                        "Attachment detected",
                        extra={
                            "message_id": message_id,
                            "attachment_name": attachment.filename,
                            "attachment_mime_type": attachment.mime_type,
                        },
                    )

                sender = str(metadata.get("sender") or sender or "")
                subject = str(metadata.get("subject") or subject or "")

                if not self._sender_matches_filter(sender, sender_filters):
                    continue
                if exclude_service_receipts and self._is_non_asset_vendor(sender):
                    service_receipts_skipped += 1
                    continue

                probable_invoice = self._subject_matches_keywords(subject, subject_filters) or self._is_probable_invoice(subject, [a.filename for a in filtered_attachments])
                if not probable_invoice or not filtered_attachments:
                    continue

                app_logger.info(
                    "Invoice candidate email identified",
                    extra={"message_id": message_id, "subject": subject},
                )

                invoice_emails_detected += 1

                if len(filtered_attachments) > 1:
                    app_logger.info(
                        "Multiple attachments detected in email",
                        extra={"message_id": message_id, "count": len(filtered_attachments)},
                    )

                scored_attachments: list[dict[str, Any]] = []
                for attachment in filtered_attachments:
                    app_logger.info(
                        f"Processing attachment: {attachment.filename}",
                        extra={"message_id": message_id, "attachment_name": attachment.filename},
                    )
                    attachment_bytes = await self.gmail.get_attachment_data(access_token, message_id, attachment.attachment_id)
                    if not attachment_bytes:
                        app_logger.warning(
                            "Attachment download returned empty payload",
                            extra={"message_id": message_id, "attachment_name": attachment.filename},
                        )
                        continue

                    extension = self._attachment_extension(attachment.filename, attachment.mime_type)
                    tmp_path: Path | None = None
                    try:
                        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
                            temp_file.write(attachment_bytes)
                            tmp_path = Path(temp_file.name)

                        score_result = self.parser.score_attachment_invoice_likelihood(
                            file_path=tmp_path,
                            filename=attachment.filename,
                        )
                        score_result.update(
                            {
                                "attachment": attachment,
                                "attachment_bytes": attachment_bytes,
                                "extension": extension,
                            }
                        )
                        scored_attachments.append(score_result)

                        app_logger.info(
                            "Extracted invoice text length",
                            extra={
                                "message_id": message_id,
                                "attachment_name": attachment.filename,
                                "text_length": len(str(score_result.get("text") or "")),
                            },
                        )

                        if score_result.get("is_invoice_candidate"):
                            app_logger.info(
                                "Invoice indicators detected in attachment",
                                extra={
                                    "message_id": message_id,
                                    "attachment_name": attachment.filename,
                                    "score": score_result.get("score"),
                                    "indicators": score_result.get("indicator_hits"),
                                },
                            )
                    finally:
                        if tmp_path and tmp_path.exists():
                            tmp_path.unlink(missing_ok=True)

                invoice_candidates = [s for s in scored_attachments if bool(s.get("is_invoice_candidate"))]
                invoice_candidates.sort(key=lambda item: int(item.get("score") or 0), reverse=True)
                selected_candidates = invoice_candidates[:3]

                if selected_candidates:
                    main = selected_candidates[0]["attachment"]
                    app_logger.info(
                        "Selected attachment as main invoice",
                        extra={"message_id": message_id, "attachment_name": main.filename},
                    )
                else:
                    app_logger.info(
                        "No invoice attachment detected, falling back to email body",
                        extra={"message_id": message_id},
                    )

                base_item = parsed_items[0] if parsed_items else {
                    "product_name": "Unknown Asset",
                    "source": "gmail",
                    "email_message_id": message_id,
                }

                if not selected_candidates:
                    fallback_item = dict(base_item)
                    fallback_item["sender"] = sender
                    fallback_item["subject"] = subject
                    fallback_item["email_date"] = metadata.get("email_date")
                    fallback_item["source_email_id"] = message_id
                    fallback_item.pop("_body_complete", None)

                    self._ensure_minimum_suggestion_payload(fallback_item, sender=sender, subject=subject, message_id=message_id)
                    self._log_parsed_fields(message_id, fallback_item)

                    already_added, duplicate_reason = await self.suggestions.is_already_added(user_id, fallback_item)
                    if already_added:
                        skipped_duplicates += 1
                        app_logger.info(
                            "Suggestion skipped due to duplicate detection",
                            extra={"message_id": message_id, "duplicate_reason": duplicate_reason or "unknown"},
                        )
                    app_logger.info("Creating asset suggestion", extra={"message_id": message_id, "is_fallback": True})
                    created_suggestions += await self.suggestions.create_suggestions(user_id, fallback_item, already_added=already_added)
                    continue

                for index, candidate in enumerate(selected_candidates):
                    candidate_attachment = candidate["attachment"]
                    candidate_bytes = candidate.get("attachment_bytes") or b""
                    candidate_extension = str(candidate.get("extension") or ".bin")

                    item = dict(base_item)
                    item["sender"] = sender
                    item["subject"] = subject
                    item["email_date"] = metadata.get("email_date")
                    item["source_email_id"] = message_id
                    item["attachment_id"] = candidate_attachment.attachment_id
                    item["attachment_filename"] = candidate_attachment.filename
                    item["attachment_mime_type"] = candidate_attachment.mime_type

                    parse_path: Path | None = None
                    persistent_invoice_path: str | None = None
                    try:
                        if index == 0:
                            user_folder = self.INVOICE_UPLOAD_DIR / user_id
                            user_folder.mkdir(parents=True, exist_ok=True)
                            safe_name = self._safe_filename(candidate_attachment.filename)
                            destination = user_folder / f"{message_id}_{safe_name}"
                            if destination.suffix.lower() != candidate_extension:
                                destination = destination.with_suffix(candidate_extension)
                            destination.write_bytes(candidate_bytes)
                            persistent_invoice_path = str(destination)
                            parse_path = destination
                            item["invoice_attachment_path"] = persistent_invoice_path
                            attachments_downloaded += 1
                        else:
                            with tempfile.NamedTemporaryFile(delete=False, suffix=candidate_extension) as temp_file:
                                temp_file.write(candidate_bytes)
                                parse_path = Path(temp_file.name)

                        body_complete = bool(item.pop("_body_complete", False))
                        if parse_path and (not body_complete and not (item.get("price") and item.get("purchase_date"))):
                            parsed_details = self.parser.parse_attachment(
                                file_path=parse_path,
                                sender=sender,
                                subject=subject,
                                fallback_name=item.get("product_name"),
                                existing_data={k: v for k, v in item.items() if v is not None and not k.startswith("_")},
                            )
                            self._merge_parsed_fields(item, parsed_details)
                            attachments_processed += 1
                    except Exception as parse_err:
                        app_logger.warning(
                            "Attachment parse during scan failed",
                            extra={"message_id": message_id, "error": str(parse_err)},
                        )
                    finally:
                        if parse_path and (not persistent_invoice_path) and parse_path.exists():
                            parse_path.unlink(missing_ok=True)

                    self._ensure_minimum_suggestion_payload(item, sender=sender, subject=subject, message_id=message_id)
                    self._log_parsed_fields(message_id, item)

                    already_added, duplicate_reason = await self.suggestions.is_already_added(user_id, item)
                    if already_added:
                        skipped_duplicates += 1
                        app_logger.info(
                            "Suggestion skipped due to duplicate detection",
                            extra={"message_id": message_id, "duplicate_reason": duplicate_reason or "unknown"},
                        )

                    app_logger.info("Creating asset suggestion", extra={"message_id": message_id, "is_fallback": False})
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
            "service_receipts_skipped": service_receipts_skipped,
            "created_suggestions": created_suggestions,
            "assets_detected": created_suggestions,
            "skipped_duplicates": skipped_duplicates,
            "assets_added_by_user": assets_added_by_user,
            "suggestions": pending_suggestions,
        }
