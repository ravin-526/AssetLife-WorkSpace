from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from PyPDF2 import PdfReader

try:
    import pytesseract
    from PIL import Image
except Exception:  # pragma: no cover
    pytesseract = None
    Image = None

from app.core.logger import app_logger

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"[ \t]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")

_MONTH_MAP: dict[str, int] = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


@dataclass
class ParsedAttachment:
    attachment_id: str
    filename: str
    mime_type: str


class InvoiceParserService:
    EXCHANGE_RATE_ENDPOINT = "https://open.er-api.com/v6/latest/{currency}"
    EXCHANGE_TIMEOUT_SECONDS = 6.0

    STATIC_FX_TO_INR: dict[str, float] = {
        "USD": 83.2,
        "EUR": 90.0,
        "GBP": 105.0,
        "AED": 22.6,
        "SGD": 61.8,
    }

    IGNORE_AMOUNT_LINE_KEYWORDS = {
        "subtotal",
        "tax",
        "gst",
        "cgst",
        "sgst",
        "shipping",
        "delivery",
        "discount",
    }

    # Ignore keywords that indicate a line should be skipped ONLY when no priority keyword is present.
    # This prevents "Total Amount (incl. Tax)" from being discarded because it contains "tax".

    AMOUNT_PRIORITY_KEYWORDS = {
        "payment summary": 130,   # Uber/Ola-style section header
        "grand total": 120,
        "total amount": 110,
        "amount paid": 100,
        "amount payable": 100,
        "payable amount": 100,
        "net payable": 100,
        "order total": 95,
        "total payable": 90,
        "final amount": 90,
        "total due": 90,
        "total": 70,
    }

    INVOICE_DETAIL_LINE_KEYWORDS = {
        "vendor",
        "seller",
        "product",
        "description",
        "quantity",
        "order id",
        "order date",
        "invoice date",
        "invoice number",
        "invoice no",
        "payment method",
        "payment date",
        "order summary",
        "grand total",
        "total amount",
        "total payable",
        "amount paid",
        "receipt number",
        "receipt no",
        "transaction id",
        "transaction no",
        "purchase date",
        "bill date",
        "bill no",
    }

    CURRENCY_TOKEN_MAP = {
        "₹": "INR",
        "rs": "INR",
        "rs.": "INR",
        "inr": "INR",
        "$": "USD",
        "usd": "USD",
        "€": "EUR",
        "eur": "EUR",
        "£": "GBP",
        "gbp": "GBP",
        "aed": "AED",
        "sgd": "SGD",
    }

    # Maximum plausible invoice amount in any currency.
    # Values above this threshold are almost certainly a regex parsing artefact
    # (e.g. multiple numeric cells concatenated into one token) and are rejected.
    AMOUNT_MAX_PLAUSIBLE = 100_000_000.0  # 10 crore INR / ~$1.2 M

    AMOUNT_PATTERN = re.compile(
        r"(?:(₹|rs\.?|inr|\$|usd|€|eur|£|gbp|aed|sgd)\s*)?"
        # Integer part: 1-3 leading digits, then up to 4 comma-separated groups
        # of 2-3 digits each.  This covers both the Western (1,234,567) and Indian
        # (1,23,45,678) formats while refusing to match a pathological string like
        # 17,73,14,62,27,07,92,872 that would result from concatenated table cells.
        r"([0-9]{1,3}(?:,[0-9]{2,3}){0,4}(?:\.[0-9]{1,2})?)"
        r"(?:\s*(₹|rs\.?|inr|\$|usd|€|eur|£|gbp|aed|sgd))?",
        re.IGNORECASE,
    )

    DATE_CONTEXT_RE = re.compile(
        r"(?:invoice\s+date|order\s+date|purchase\s+date|date\s+of\s+purchase|bill\s+date|date)\s*[:\-]?\s*",
        re.IGNORECASE,
    )

    DATE_PATTERNS: list[re.Pattern[str]] = [
        re.compile(r"\b(\d{4}-\d{2}-\d{2})\b"),
        re.compile(r"\b(\d{2}/\d{2}/\d{4})\b"),
        re.compile(r"\b(\d{2}-\d{2}-\d{4})\b"),
        re.compile(
            r"\b(\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
            r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4})\b",
            re.IGNORECASE,
        ),
        re.compile(
            r"\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
            r"jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b",
            re.IGNORECASE,
        ),
    ]

    INVOICE_NUMBER_PATTERNS: list[re.Pattern[str]] = [
        re.compile(r"invoice\s*(?:number|no\.?|#|id)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"invoice\s*[:#\-]\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"tax\s*invoice\s*(?:no\.?|number|id|#)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"inv\s*(?:no\.?|#|id)?\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"bill\s*no\.?\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"receipt\s*(?:number|no\.?|id|#)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"order\s*(?:id|number|no\.?|#)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"transaction\s*(?:no\.?|id|number)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"reference\s*(?:no\.?|id|number)?\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"document\s*no\.?\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"ref\s*no\.?\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
        re.compile(r"txn\s*(?:id|no\.?)\s*[:#\-]?\s*([A-Za-z0-9\-_/]{3,40})", re.IGNORECASE),
    ]

    PRODUCT_KEYWORD_RE = re.compile(
        r"(?:product|item|description|order\s+item|product\s+name)\s*[:\-]\s*([^\n\r]{3,140})",
        re.IGNORECASE | re.MULTILINE,
    )

    VENDOR_RE = re.compile(r"(?:vendor|seller|merchant|sold\s+by)\s*[:\-]\s*([^\n\r]{2,120})", re.IGNORECASE)

    GENERIC_LINE_RE = re.compile(
        r"^\s*(?:invoice|order\s+summary|thank\s+you|your\s+order|payment\s+receipt|tax\s+invoice|"
        r"bill\s+of\s+sale|receipt|dear\s+\w|hi\s+\w|hello\s+\w|regards|sincerely|subtotal|"
        r"shipping|delivery|discount|coupon|promo)\b",
        re.IGNORECASE,
    )

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
    def _normalize_html(html_text: str) -> str:
        text = _HTML_TAG_RE.sub(" ", html_text)
        for entity, replacement in (
            ("&nbsp;", " "),
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&#39;", "'"),
            ("&quot;", '"'),
        ):
            text = text.replace(entity, replacement)
        return text

    @staticmethod
    def _normalize_whitespace(text: str) -> str:
        text = _WHITESPACE_RE.sub(" ", text)
        text = _MULTI_NEWLINE_RE.sub("\n\n", text)
        return text.strip()

    @staticmethod
    def _decode_base64_part(data: str) -> str:
        try:
            padded = data + "=" * (-len(data) % 4)
            return base64.urlsafe_b64decode(padded.encode()).decode("utf-8", errors="ignore")
        except Exception:
            return ""

    @classmethod
    def _extract_body_text(cls, payload: dict[str, Any]) -> str:
        plain_parts: list[str] = []
        html_parts: list[str] = []

        def visit(part: dict[str, Any]) -> None:
            mime = str(part.get("mimeType") or "").lower()
            body = part.get("body") or {}
            raw_data = str(body.get("data") or "")
            if raw_data:
                decoded = cls._decode_base64_part(raw_data)
                if mime == "text/plain":
                    plain_parts.append(decoded)
                elif mime == "text/html":
                    html_parts.append(cls._normalize_html(decoded))
            for child in part.get("parts") or []:
                if isinstance(child, dict):
                    visit(child)

        visit(payload)

        if plain_parts:
            return cls._normalize_whitespace("\n".join(plain_parts))
        if html_parts:
            return cls._normalize_whitespace("\n".join(html_parts))
        return ""

    @classmethod
    def _normalize_date(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(value, fmt).date().isoformat()
            except ValueError:
                continue
        return cls._parse_month_name_date(value)

    @staticmethod
    def _parse_month_name_date(value: str) -> str | None:
        value = value.strip().rstrip(",")
        parts = re.split(r"[\s,]+", value)
        if len(parts) < 3:
            return None
        if re.match(r"^\d{1,2}$", parts[0]) and parts[1].lower()[:3] in _MONTH_MAP and re.match(r"^\d{4}$", parts[-1]):
            try:
                return datetime(int(parts[-1]), _MONTH_MAP[parts[1].lower()[:3]], int(parts[0])).date().isoformat()
            except ValueError:
                pass
        if parts[0].lower()[:3] in _MONTH_MAP and re.match(r"^\d{1,2},?$", parts[1]) and re.match(r"^\d{4}$", parts[-1]):
            try:
                return datetime(int(parts[-1]), _MONTH_MAP[parts[0].lower()[:3]], int(parts[1].rstrip(","))).date().isoformat()
            except ValueError:
                pass
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
    def _extract_text_from_pdf(file_path: Path) -> str:
        try:
            reader = PdfReader(str(file_path))
        except Exception:
            return ""

        pages: list[str] = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(pages).strip()

    @staticmethod
    def _extract_text_from_image(file_path: Path) -> str:
        if not pytesseract or not Image:
            return ""

        try:
            with Image.open(file_path) as image:
                return str(pytesseract.image_to_string(image) or "").strip()
        except Exception:
            return ""

    def _extract_text_from_attachment(self, file_path: Path) -> str:
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            return self._extract_text_from_pdf(file_path)
        if suffix in {".png", ".jpg", ".jpeg"}:
            return self._extract_text_from_image(file_path)
        return ""

    def _normalize_currency(self, token: str | None) -> str | None:
        if not token:
            return None
        normalized = token.strip().lower()
        return self.CURRENCY_TOKEN_MAP.get(normalized)

    def _extract_amount_and_currency(self, text: str) -> tuple[float | None, str | None]:
        """
        Extract the most likely invoice total amount and its currency.

        Strategy:
        - For every currency amount found, build a context window of the current
          line plus up to CONTEXT_LOOKBACK preceding non-blank lines.
        - Score each candidate using the *highest-priority* keyword found anywhere
          in that window.  Taking the max (not sum) avoids inflating scores when
          overlapping phrases like "total" and "total amount" match the same text.
        - Filter candidates whose context contains only ignore-list keywords
          (subtotal, tax, GST, ride charge, etc.) and no priority keyword.
        - From remaining candidates pick the highest-score one.
          When scores are equal, prefer the *largest* amount — the final payable
          total is almost always the largest figure on an invoice.
        """
        CONTEXT_LOOKBACK = 3  # non-blank lines to scan above the amount line

        raw_lines = text.splitlines()

        # Ordered list of non-blank line indices for efficient lookback slicing
        non_blank: list[int] = [i for i, ln in enumerate(raw_lines) if ln.strip()]
        nb_pos: dict[int, int] = {raw_idx: pos for pos, raw_idx in enumerate(non_blank)}

        # Each entry: (priority_score, amount, currency, context_label)
        candidates: list[tuple[int, float, str, str]] = []

        for raw_idx in non_blank:
            line = raw_lines[raw_idx].strip()
            cur_pos = nb_pos[raw_idx]

            # Context window: this line + up to CONTEXT_LOOKBACK preceding non-blank lines
            window_indices = non_blank[max(0, cur_pos - CONTEXT_LOOKBACK): cur_pos + 1]
            window_lower = [raw_lines[i].strip().lower() for i in window_indices]

            # Highest single keyword score in the window.
            # Using max instead of sum prevents overlapping phrases (e.g. "total" inside
            # "total amount") from artificially doubling the score.
            best_kw_score = 0
            best_kw_label = ""
            for keyword, kw_score in self.AMOUNT_PRIORITY_KEYWORDS.items():
                if kw_score > best_kw_score and any(keyword in ctx for ctx in window_lower):
                    best_kw_score = kw_score
                    best_kw_label = keyword

            # Ignore filter: when no priority keyword is present in the context
            # window, skip this line if it contains only noise words.
            if best_kw_score == 0:
                joined_window = " ".join(window_lower)
                if any(skip in joined_window for skip in self.IGNORE_AMOUNT_LINE_KEYWORDS):
                    continue

            line_has_implausible_ccy = False
            for match in self.AMOUNT_PATTERN.finditer(line):
                prefix = match.group(1)
                amount_text = match.group(2)
                suffix_token = match.group(3)
                amount = self._safe_float(amount_text)
                if amount is None or amount <= 0:
                    continue

                # Reject amounts that exceed any plausible invoice total — these
                # almost always result from the regex matching concatenated cell
                # data (e.g. "17,73,14,62,27" produced by stripped HTML tables).
                if amount > self.AMOUNT_MAX_PLAUSIBLE:
                    app_logger.debug(
                        "Rejected implausible amount: %s (raw=%r, max=%s)",
                        amount,
                        amount_text,
                        self.AMOUNT_MAX_PLAUSIBLE,
                    )
                    # A currency-tagged implausible amount flags the whole line as
                    # corrupt — subsequent bare-number sub-matches (fragments of
                    # the same broken token, e.g. "07,92,872" after "₹17,73,14,62,27"
                    # is rejected) are also discarded.
                    if prefix or suffix_token:
                        line_has_implausible_ccy = True
                    continue

                # Skip bare-number fragments that follow an implausible
                # currency-tagged amount on the same line.
                if line_has_implausible_ccy and not (prefix or suffix_token):
                    app_logger.debug(
                        "Skipping bare-number fragment after implausible amount: %r",
                        amount_text,
                    )
                    continue

                currency = self._normalize_currency(prefix) or self._normalize_currency(suffix_token)
                if not currency:
                    # Plain bare numbers with no currency symbol and no keyword
                    # context are too ambiguous (quantities, IDs, zip codes, etc.)
                    if best_kw_score == 0:
                        continue
                    currency = "INR"

                candidate_score = best_kw_score + (20 if prefix or suffix_token else 0)
                candidates.append((candidate_score, amount, currency, best_kw_label or "no_keyword"))

        if not candidates:
            return None, None

        if app_logger.isEnabledFor(logging.DEBUG):
            detected_strs = [
                f"{c} {a:.2f} (score={s}, ctx={lbl})"
                for s, a, c, lbl in candidates
            ]
            app_logger.debug("Detected currency amounts: %s", detected_strs)

        # Prefer highest keyword score; break ties by largest amount
        max_score = max(s for s, _, _, _ in candidates)
        top_candidates = [(s, a, c, lbl) for s, a, c, lbl in candidates if s == max_score]
        best_score, best_amount, best_currency, best_label = max(top_candidates, key=lambda x: x[1])

        app_logger.debug(
            "Selected final invoice amount: %s %.2f (score=%s, context=%s)",
            best_currency,
            best_amount,
            best_score,
            best_label,
        )
        return best_amount, best_currency

    def _fetch_exchange_rate_to_inr(self, from_currency: str) -> float | None:
        if from_currency == "INR":
            return 1.0

        url = self.EXCHANGE_RATE_ENDPOINT.format(currency=from_currency)
        try:
            with httpx.Client(timeout=self.EXCHANGE_TIMEOUT_SECONDS) as client:
                response = client.get(url)
                response.raise_for_status()
                payload = response.json()
                rate = (payload or {}).get("rates", {}).get("INR")
                if isinstance(rate, (int, float)) and rate > 0:
                    return float(rate)
        except Exception as error:
            app_logger.warning(
                "Exchange rate API failed, using fallback rate if available",
                extra={"currency": from_currency, "error": str(error)},
            )

        return self.STATIC_FX_TO_INR.get(from_currency)

    def _extract_price_details(self, text: str) -> dict[str, Any]:
        amount, currency = self._extract_amount_and_currency(text)
        if amount is None:
            return {
                "price": None,
                "currency": None,
                "invoice_amount": None,
                "invoice_currency": None,
                "exchange_rate": None,
                "original_amount": None,
                "original_currency": None,
                "conversion_note": None,
            }

        normalized_currency = (currency or "INR").upper()
        if normalized_currency == "INR":
            return {
                "price": amount,
                "currency": "INR",
                "invoice_amount": amount,
                "invoice_currency": "INR",
                "exchange_rate": 1.0,
                "original_amount": None,
                "original_currency": None,
                "conversion_note": None,
            }

        rate = self._fetch_exchange_rate_to_inr(normalized_currency)
        if not rate:
            return {
                "price": amount,
                "currency": normalized_currency,
                "invoice_amount": amount,
                "invoice_currency": normalized_currency,
                "exchange_rate": None,
                "original_amount": None,
                "original_currency": None,
                "conversion_note": None,
            }

        converted = round(amount * rate, 2)
        app_logger.info(
            "Currency conversion applied: %s -> INR",
            normalized_currency,
            extra={
                "from_currency": normalized_currency,
                "to_currency": "INR",
                "original_amount": amount,
                "converted_amount": converted,
                "rate": rate,
            },
        )

        note = (
            "Currency Conversion:\n"
            f"Original Amount: {normalized_currency} {amount:.2f}\n"
            f"Converted Amount: INR {converted:.2f}\n"
            "Amount converted from foreign currency to INR using exchange rate at time of processing."
        )
        return {
            "price": converted,
            "currency": "INR",
            "invoice_amount": amount,
            "invoice_currency": normalized_currency,
            "exchange_rate": rate,
            "original_amount": amount,
            "original_currency": normalized_currency,
            "conversion_note": note,
        }

    def _extract_date_from_text(self, text: str) -> str | None:
        for ctx_match in self.DATE_CONTEXT_RE.finditer(text):
            nearby = text[ctx_match.end() : ctx_match.end() + 120]
            for date_re in self.DATE_PATTERNS:
                date_match = date_re.search(nearby)
                if date_match:
                    normalized = self._normalize_date(date_match.group(1))
                    if normalized:
                        return normalized

        for date_re in self.DATE_PATTERNS:
            date_match = date_re.search(text)
            if date_match:
                normalized = self._normalize_date(date_match.group(1))
                if normalized:
                    return normalized
        return None

    def _extract_product_name_from_text(self, text: str) -> str | None:
        if not text:
            return None

        match = self.PRODUCT_KEYWORD_RE.search(text)
        if match:
            candidate = re.sub(r"\s+", " ", match.group(1)).strip(" -")
            if candidate and not self.GENERIC_LINE_RE.match(candidate) and len(candidate) >= 3:
                return candidate[:120]

        for raw_line in text.splitlines():
            line = raw_line.strip()
            if not line or len(line) < 5 or len(line) > 140:
                continue
            if self.GENERIC_LINE_RE.match(line):
                continue
            if re.search(r"[A-Z][a-z]+\s+\w*\d+\w*", line):
                return re.sub(r"\s+", " ", line)[:120]

        return None

    def _extract_vendor_from_text(self, text: str) -> str | None:
        if not text:
            return None
        match = self.VENDOR_RE.search(text)
        if not match:
            return None
        value = re.sub(r"\s+", " ", match.group(1)).strip(" -")
        return value[:120] if value else None

    def _extract_invoice_number(self, text: str) -> str | None:
        if not text:
            return None
        for pattern in self.INVOICE_NUMBER_PATTERNS:
            match = pattern.search(text)
            if match:
                value = match.group(1).strip()
                app_logger.debug("Invoice number extracted: %s", value, extra={"invoice_number": value})
                return value
        return None

    def _extract_invoice_detail_lines(self, text: str) -> list[str]:
        details: list[str] = []
        for raw_line in text.splitlines():
            line = self._normalize_whitespace(raw_line)
            if not line or len(line) > 180:
                continue
            lower = line.lower()
            if any(keyword in lower for keyword in self.INVOICE_DETAIL_LINE_KEYWORDS):
                details.append(line)
            if len(details) >= 8:
                break
        return details

    def _build_description(
        self,
        existing_description: str | None,
        detail_lines: list[str],
        conversion_note: str | None,
    ) -> str | None:
        sections: list[str] = []

        if existing_description and str(existing_description).strip():
            sections.append(str(existing_description).strip())

        if detail_lines:
            details_block = "Invoice Details:\n" + "\n".join(detail_lines)
            sections.append(details_block)
            app_logger.debug("Invoice details added to description", extra={"detail_count": len(detail_lines)})

        if conversion_note:
            sections.append(conversion_note)

        if not sections:
            return None
        return "\n\n".join(sections)

    def _extract_all_from_text(self, text: str) -> dict[str, Any]:
        if not text:
            return {}

        price_details = self._extract_price_details(text)
        return {
            "product_name": self._extract_product_name_from_text(text),
            "vendor": self._extract_vendor_from_text(text),
            "price": price_details.get("price"),
            "currency": price_details.get("currency"),
            "invoice_amount": price_details.get("invoice_amount"),
            "invoice_currency": price_details.get("invoice_currency"),
            "exchange_rate": price_details.get("exchange_rate"),
            "original_amount": price_details.get("original_amount"),
            "original_currency": price_details.get("original_currency"),
            "conversion_note": price_details.get("conversion_note"),
            "purchase_date": self._extract_date_from_text(text),
            "invoice_number": self._extract_invoice_number(text),
            "detail_lines": self._extract_invoice_detail_lines(text),
        }

    def score_attachment_invoice_likelihood(self, *, file_path: Path, filename: str) -> dict[str, Any]:
        """Score whether an attachment is likely an invoice using extracted text only."""
        score = 0
        reasons: list[str] = []
        indicator_hits = 0

        extracted_text = self._extract_text_from_attachment(file_path)
        text_lower = extracted_text.lower()

        def add_indicator(condition: bool, weight: int, reason: str) -> None:
            nonlocal score, indicator_hits
            if condition:
                score += weight
                indicator_hits += 1
                reasons.append(reason)

        add_indicator("invoice number" in text_lower, 5, "text:+invoice_number")
        add_indicator("tax invoice" in text_lower, 5, "text:+tax_invoice")
        add_indicator("invoice no" in text_lower or "invoice #" in text_lower, 4, "text:+invoice_no")
        add_indicator("order id" in text_lower, 4, "text:+order_id")
        add_indicator("bill no" in text_lower, 3, "text:+bill_no")
        add_indicator("receipt" in text_lower, 3, "text:+receipt")
        add_indicator("total amount" in text_lower, 3, "text:+total_amount")
        add_indicator("grand total" in text_lower, 3, "text:+grand_total")
        add_indicator("amount paid" in text_lower, 3, "text:+amount_paid")

        has_currency = bool(re.search(r"(?:₹|\$|€|£|\binr\b|\busd\b|\beur\b|\bgbp\b|\baed\b|\bsgd\b)", text_lower))
        has_currency_amount = bool(re.search(r"(?:₹|\$|€|£|\binr\b|\busd\b|\beur\b|\bgbp\b)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?", text_lower))
        if has_currency:
            score += 2
            reasons.append("text:+currency")
        if has_currency_amount:
            score += 2
            reasons.append("text:+currency_amount")

        return {
            "score": score,
            "reasons": reasons,
            "text": extracted_text,
            "indicator_hits": indicator_hits,
            "is_invoice_candidate": indicator_hits >= 2 or score >= 5,
        }

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
        body_text = self._extract_body_text(payload)
        body_data: dict[str, Any] = {}
        if body_text:
            app_logger.info(
                "Extracted invoice text length",
                extra={"message_id": message_id, "source": "email_body", "text_length": len(body_text)},
            )
            body_data = self._extract_all_from_text(body_text)
            extracted_fields = [k for k, v in body_data.items() if v and k != "detail_lines"]
            if extracted_fields:
                app_logger.info(
                    "Invoice data extracted from email body",
                    extra={"message_id": message_id, "fields": extracted_fields},
                )

        subject_date: str | None = None
        if not body_data.get("purchase_date"):
            for date_re in self.DATE_PATTERNS:
                date_match = date_re.search(subject or "")
                if date_match:
                    subject_date = self._normalize_date(date_match.group(1))
                    if subject_date:
                        break

        item = {
            "product_name": body_data.get("product_name")
            or self._guess_product_name(subject=subject, fallback_name=None, file_path=Path(f"{message_id}.pdf")),
            "vendor": body_data.get("vendor") or probable_vendor,
            "brand": None,
            "price": body_data.get("price"),
            "currency": body_data.get("currency") or "INR",
            "invoice_amount": body_data.get("invoice_amount"),
            "invoice_currency": body_data.get("invoice_currency") or (body_data.get("currency") or "INR"),
            "exchange_rate": body_data.get("exchange_rate"),
            "original_amount": body_data.get("original_amount"),
            "original_currency": body_data.get("original_currency"),
            "purchase_date": body_data.get("purchase_date") or subject_date,
            "invoice_number": body_data.get("invoice_number"),
            "description": self._build_description(None, body_data.get("detail_lines") or [], body_data.get("conversion_note")),
            "quantity": 1,
            "warranty": None,
            "source": "gmail",
            "email_message_id": message_id,
            "_body_complete": bool(body_data.get("price") and body_data.get("purchase_date")),
        }

        metadata = {
            "sender": sender,
            "subject": subject,
            "email_date": email_date,
        }
        return [item], attachments, metadata

    def parse_attachment(
        self,
        *,
        file_path: Path,
        sender: str | None,
        subject: str | None,
        fallback_name: str | None,
        existing_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        prior = existing_data or {}

        extracted_text = self._extract_text_from_attachment(file_path)
        suffix = file_path.suffix.lower()
        app_logger.info(
            "Extracted invoice text length",
            extra={"source": "attachment", "attachment_name": file_path.name, "text_length": len(extracted_text)},
        )
        if extracted_text:
            if suffix == ".pdf":
                app_logger.info("Invoice parsed from PDF attachment", extra={"file": file_path.name})
            elif suffix in {".png", ".jpg", ".jpeg"}:
                app_logger.info("OCR extraction used for image attachment", extra={"file": file_path.name})
        else:
            app_logger.info("Fallback extraction used", extra={"file": file_path.name})

        text_seed = f"{subject or ''} {file_path.name}".strip()
        parser_text = f"{text_seed}\n{extracted_text}" if extracted_text else text_seed
        att_data = self._extract_all_from_text(parser_text)

        app_logger.info(
            "Invoice parser output",
            extra={
                "attachment_name": file_path.name,
                "parsed_product_name": str(att_data.get("product_name") or ""),
                "parsed_price": att_data.get("price"),
                "parsed_purchase_date": att_data.get("purchase_date"),
                "parsed_invoice_number": str(att_data.get("invoice_number") or ""),
            },
        )

        return {
            "product_name": prior.get("product_name")
            or att_data.get("product_name")
            or self._guess_product_name(subject=subject, fallback_name=fallback_name, file_path=file_path),
            "vendor": prior.get("vendor") or att_data.get("vendor") or self._email_sender_name(sender),
            "brand": prior.get("brand"),
            "price": prior.get("price") if prior.get("price") is not None else att_data.get("price"),
            "currency": prior.get("currency") or att_data.get("currency") or "INR",
            "invoice_amount": prior.get("invoice_amount") if prior.get("invoice_amount") is not None else att_data.get("invoice_amount"),
            "invoice_currency": prior.get("invoice_currency") or att_data.get("invoice_currency") or (prior.get("currency") or att_data.get("currency") or "INR"),
            "exchange_rate": prior.get("exchange_rate") if prior.get("exchange_rate") is not None else att_data.get("exchange_rate"),
            "original_amount": prior.get("original_amount") or att_data.get("original_amount"),
            "original_currency": prior.get("original_currency") or att_data.get("original_currency"),
            "purchase_date": prior.get("purchase_date") or att_data.get("purchase_date"),
            "invoice_number": prior.get("invoice_number") or att_data.get("invoice_number"),
            "description": self._build_description(
                prior.get("description"),
                att_data.get("detail_lines") or [],
                att_data.get("conversion_note"),
            ),
            "warranty": prior.get("warranty"),
        }
