from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class ParsedAttachment:
    attachment_id: str
    filename: str
    mime_type: str


class InvoiceParserService:
    PRICE_PATTERN = re.compile(r"(?:rs\.?|inr|usd|eur|total)\s*[:\-]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", re.IGNORECASE)
    DATE_PATTERN = re.compile(r"(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})")

    @staticmethod
    def _safe_float(value: str | None) -> float | None:
        if not value:
            return None
        normalized = value.replace(",", "").strip()
        try:
            return float(normalized)
        except ValueError:
            return None

    @staticmethod
    def _normalize_date(value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                continue
        return None

    @staticmethod
    def _email_sender_name(sender: str | None) -> str | None:
        if not sender:
            return None
        raw = sender.strip()
        if "<" in raw:
            return raw.split("<", 1)[0].strip().strip('"') or None
        if "@" in raw:
            domain = raw.split("@", 1)[1]
            return domain.split(".", 1)[0].replace("-", " ").title()
        return raw

    @staticmethod
    def _guess_product_name(subject: str | None, fallback_name: str | None, file_path: Path) -> str:
        if fallback_name and fallback_name.strip() and fallback_name.strip().lower() != "unknown asset":
            return fallback_name.strip()

        if subject:
            cleaned_subject = re.sub(r"\b(invoice|receipt|tax|order|payment|bill)\b", "", subject, flags=re.IGNORECASE)
            cleaned_subject = re.sub(r"[^a-zA-Z0-9\s-]", " ", cleaned_subject)
            cleaned_subject = re.sub(r"\s+", " ", cleaned_subject).strip(" -_")
            if cleaned_subject:
                return cleaned_subject[:120]

        stem = file_path.stem.replace("_", " ").replace("-", " ").strip()
        if stem:
            return stem[:120]
        return "Detected Asset"

    def parse_message(self, message_id: str, payload: dict[str, Any]) -> tuple[list[dict[str, Any]], list[ParsedAttachment], dict[str, Any]]:
        headers = payload.get("headers") or []
        sender = ""
        subject = ""
        email_date = None
        for header in headers:
            name = str(header.get("name") or "").lower()
            value = str(header.get("value") or "")
            if name == "from":
                sender = value
            elif name == "subject":
                subject = value
            elif name == "date":
                email_date = value

        attachments: list[ParsedAttachment] = []

        def visit_part(part: dict[str, Any]) -> None:
            filename = str(part.get("filename") or "")
            body = part.get("body") or {}
            attachment_id = str(body.get("attachmentId") or "")
            mime_type = str(part.get("mimeType") or "")
            if filename and attachment_id:
                attachments.append(ParsedAttachment(attachment_id=attachment_id, filename=filename, mime_type=mime_type))

            nested = part.get("parts") or []
            if isinstance(nested, list):
                for child in nested:
                    if isinstance(child, dict):
                        visit_part(child)

        visit_part(payload)

        probable_vendor = self._email_sender_name(sender)
        item = {
            "product_name": self._guess_product_name(subject=subject, fallback_name=None, file_path=Path(f"{message_id}.pdf")),
            "vendor": probable_vendor,
            "brand": None,
            "price": None,
            "purchase_date": self._normalize_date(self.DATE_PATTERN.search(subject or "").group(1)) if self.DATE_PATTERN.search(subject or "") else None,
            "quantity": 1,
            "warranty": None,
            "source": "gmail",
            "email_message_id": message_id,
        }

        metadata = {
            "sender": sender,
            "subject": subject,
            "email_date": email_date,
        }
        return [item], attachments, metadata

    def parse_attachment(self, *, file_path: Path, sender: str | None, subject: str | None, fallback_name: str | None) -> dict[str, Any]:
        text_seed = f"{subject or ''} {file_path.name}"
        price_match = self.PRICE_PATTERN.search(text_seed)
        date_match = self.DATE_PATTERN.search(text_seed)
        return {
            "product_name": self._guess_product_name(subject=subject, fallback_name=fallback_name, file_path=file_path),
            "vendor": self._email_sender_name(sender),
            "brand": None,
            "price": self._safe_float(price_match.group(1) if price_match else None),
            "purchase_date": self._normalize_date(date_match.group(1) if date_match else None),
            "warranty": None,
        }