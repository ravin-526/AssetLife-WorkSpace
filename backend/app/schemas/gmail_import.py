from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class GmailConnectResponse(BaseModel):
    auth_url: str
    state: str


class GmailConnectRequest(BaseModel):
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class GmailConnectionStatus(BaseModel):
    connected: bool
    mailbox_type: str = "gmail"
    email_address: str | None = None
    last_sync_at: datetime | None = None


class GmailCallbackRequest(BaseModel):
    code: str
    state: str


class GmailDisconnectResponse(BaseModel):
    disconnected: bool = True


class GmailSyncRequest(BaseModel):
    days: int = Field(default=10, ge=1, le=90)
    max_results: int = Field(default=100, ge=1, le=500)
    subject_keywords: list[str] | None = None
    sender_addresses: list[str] | None = None
    email: str | None = Field(default=None, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SuggestionResponse(BaseModel):
    id: str
    product_name: str
    brand: str | None = None
    vendor: str | None = None
    price: float | None = None
    purchase_date: datetime | None = None
    sender: str | None = None
    subject: str | None = None
    email_date: datetime | None = None
    quantity: int = 1
    source: str = "gmail"
    status: str
    warranty: str | None = None
    email_message_id: str
    attachment_filename: str | None = None
    attachment_mime_type: str | None = None
    action_options: list[str] = Field(default_factory=lambda: ["add", "skip"])
    already_added: bool = False
    created_at: datetime


class GmailSyncResponse(BaseModel):
    sync_status: str
    scanned: int
    emails_scanned: int = 0
    purchase_emails_detected: int = 0
    invoice_emails: int = 0
    attachments_detected: int = 0
    attachments_found: int = 0
    attachments_downloaded: int = 0
    attachments_processed: int = 0
    created_suggestions: int
    assets_detected: int = 0
    skipped_duplicates: int
    assets_added_by_user: int = 0
    suggestions: list[SuggestionResponse] = Field(default_factory=list)


class EmailScanResponse(BaseModel):
    id: str
    sender: str
    subject: str
    email_date: datetime | None = None
    scan_status: str
    detected_items_count: int = 0
    source: str = "gmail"
    error_message: str | None = None
    created_at: datetime


class SuggestionActionResponse(BaseModel):
    suggestion_id: str
    status: str
    asset_id: str | None = None
    asset: dict[str, Any] | None = None


class SuggestionParseResponse(BaseModel):
    suggestion_id: str
    status: str
    message: str
    product_name: str | None = None
    brand: str | None = None
    vendor: str | None = None
    price: float | None = None
    purchase_date: datetime | None = None
    warranty: str | None = None
