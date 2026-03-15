from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook

from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/assets", tags=["Assets"])

UPLOAD_ROOT = Path("backend/uploads")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
DOC_ROOT = UPLOAD_ROOT / "documents"
DOC_ROOT.mkdir(parents=True, exist_ok=True)

EXCEL_TEMPLATE_COLUMNS = [
    "product_name",
    "brand",
    "vendor",
    "price",
    "purchase_date",
    "category",
    "subcategory",
    "serial_number",
    "model_number",
    "invoice_number",
    "description",
    "notes",
    "location",
    "assigned_user",
    "warranty_available",
    "warranty_provider",
    "warranty_type",
    "warranty_start_date",
    "warranty_end_date",
    "warranty_notes",
    "warranty_reminder_30_days",
    "warranty_reminder_7_days",
    "warranty_reminder_on_expiry",
    "insurance_available",
    "insurance_provider",
    "insurance_policy_number",
    "insurance_start_date",
    "insurance_expiry_date",
    "insurance_premium_amount",
    "insurance_coverage_notes",
    "insurance_reminder_45_days",
    "insurance_reminder_15_days",
    "service_required",
    "service_frequency",
    "service_custom_interval_days",
    "service_reminder_enabled",
]

EXCEL_TEMPLATE_SAMPLE_ROWS = [
    [
        "MacBook Pro 16",
        "Apple",
        "iStore",
        249999,
        "2024-01-12",
        "Electronics",
        "Laptop",
        "MBP16-001",
        "A2780",
        "INV-APL-2024-001",
        "Engineering laptop",
        "Issued to design team",
        "Bangalore HQ",
        "Asha N",
        "yes",
        "Apple Care",
        "manufacturer",
        "2024-01-12",
        "2027-01-11",
        "3 year plan",
        "yes",
        "yes",
        "yes",
        "yes",
        "HDFC Ergo",
        "POL-APL-9910",
        "2024-01-12",
        "2025-01-11",
        12999,
        "Accidental damage cover",
        "yes",
        "yes",
        "yes",
        "yearly",
        "",
        "yes",
    ],
    [
        "Dell XPS 13",
        "Dell",
        "Dell Store",
        145000,
        "2024-02-03",
        "Electronics",
        "Laptop",
        "DX13-7781",
        "XPS-9315",
        "INV-DEL-2024-013",
        "Sales leadership laptop",
        "",
        "Mumbai Office",
        "Rohit M",
        "yes",
        "Dell Warranty",
        "extended",
        "2024-02-03",
        "2026-02-02",
        "Extended coverage",
        "yes",
        "yes",
        "yes",
        "no",
        "",
        "",
        "",
        "",
        "",
        "",
        "no",
        "no",
        "yes",
        "half_yearly",
        "",
        "yes",
    ],
    [
        "iPhone 15",
        "Apple",
        "Unicorn",
        89900,
        "2024-03-15",
        "Electronics",
        "Mobile",
        "IPH15-9981",
        "A3090",
        "INV-APL-2024-089",
        "Executive phone",
        "Dual SIM setup",
        "Chennai Branch",
        "Priya S",
        "yes",
        "Apple Care+",
        "manufacturer",
        "2024-03-15",
        "2026-03-14",
        "",
        "yes",
        "yes",
        "yes",
        "yes",
        "Bajaj Allianz",
        "POL-IPH-4401",
        "2024-03-15",
        "2025-03-14",
        5500,
        "Screen and theft cover",
        "yes",
        "yes",
        "yes",
        "yearly",
        "",
        "yes",
    ],
    [
        "Canon EOS R8",
        "Canon",
        "PhotoWorld",
        128500,
        "2024-04-01",
        "Electronics",
        "Camera",
        "CANR8-3002",
        "EOS-R8",
        "INV-CAN-2024-020",
        "Content team camera",
        "",
        "Studio",
        "Media Desk",
        "yes",
        "Canon India",
        "manufacturer",
        "2024-04-01",
        "2026-03-31",
        "",
        "yes",
        "yes",
        "yes",
        "no",
        "",
        "",
        "",
        "",
        "",
        "",
        "no",
        "no",
        "yes",
        "quarterly",
        "",
        "yes",
    ],
    [
        "Samsung 55 TV",
        "Samsung",
        "Reliance Digital",
        62999,
        "2024-04-28",
        "Electronics",
        "Television",
        "SAMTV55-773",
        "UA55AU7700",
        "INV-SAM-2024-114",
        "Meeting room display",
        "Wall mounted",
        "Pune Office",
        "Facilities",
        "yes",
        "Samsung Care",
        "extended",
        "2024-04-28",
        "2027-04-27",
        "",
        "yes",
        "yes",
        "yes",
        "yes",
        "ICICI Lombard",
        "POL-TV-7782",
        "2024-04-28",
        "2025-04-27",
        3800,
        "Power surge cover",
        "yes",
        "yes",
        "yes",
        "yearly",
        "",
        "yes",
    ],
    [
        "HP LaserJet Pro",
        "HP",
        "HP Store",
        32990,
        "2024-05-06",
        "Electronics",
        "Printer",
        "HPLJ-2190",
        "MFP-4104",
        "INV-HP-2024-045",
        "Admin floor printer",
        "",
        "Hyderabad Office",
        "Admin Team",
        "yes",
        "HP",
        "manufacturer",
        "2024-05-06",
        "2025-05-05",
        "",
        "yes",
        "yes",
        "yes",
        "no",
        "",
        "",
        "",
        "",
        "",
        "",
        "no",
        "no",
        "yes",
        "quarterly",
        "",
        "yes",
    ],
    [
        "Daikin Split AC",
        "Daikin",
        "Cooling Hub",
        48750,
        "2024-05-22",
        "Appliances",
        "Air Conditioner",
        "DKAC-8804",
        "FTKF50",
        "INV-DKN-2024-061",
        "Server room AC",
        "24x7 operation",
        "Data Center",
        "Infra Team",
        "yes",
        "Daikin",
        "manufacturer",
        "2024-05-22",
        "2026-05-21",
        "",
        "yes",
        "yes",
        "yes",
        "yes",
        "Tata AIG",
        "POL-AC-9012",
        "2024-05-22",
        "2025-05-21",
        2750,
        "Compressor cover",
        "yes",
        "yes",
        "yes",
        "half_yearly",
        "",
        "yes",
    ],
    [
        "Godrej Refrigerator",
        "Godrej",
        "HomeTown",
        28990,
        "2024-06-02",
        "Appliances",
        "Refrigerator",
        "GDRF-5501",
        "RT-EON",
        "INV-GOD-2024-033",
        "Pantry refrigerator",
        "",
        "Kolkata Office",
        "Office Ops",
        "yes",
        "Godrej Care",
        "manufacturer",
        "2024-06-02",
        "2027-06-01",
        "",
        "yes",
        "yes",
        "yes",
        "no",
        "",
        "",
        "",
        "",
        "",
        "",
        "no",
        "no",
        "yes",
        "yearly",
        "",
        "yes",
    ],
    [
        "Bosch Drill Kit",
        "Bosch",
        "Tool Mart",
        14999,
        "2024-06-19",
        "Tools",
        "Power Tools",
        "BSCH-DR-118",
        "GSB-13",
        "INV-BOS-2024-018",
        "Maintenance toolkit",
        "Includes bits set",
        "Maintenance Room",
        "Facilities",
        "yes",
        "Bosch",
        "manufacturer",
        "2024-06-19",
        "2026-06-18",
        "",
        "yes",
        "yes",
        "yes",
        "no",
        "",
        "",
        "",
        "",
        "",
        "",
        "no",
        "no",
        "yes",
        "custom",
        120,
        "yes",
    ],
    [
        "Lenovo ThinkPad E14",
        "Lenovo",
        "Lenovo Store",
        78999,
        "2024-07-03",
        "Electronics",
        "Laptop",
        "LTP-E14-562",
        "ThinkPad-E14",
        "INV-LEN-2024-072",
        "HR team laptop",
        "",
        "Delhi Office",
        "Kiran P",
        "yes",
        "Lenovo",
        "manufacturer",
        "2024-07-03",
        "2027-07-02",
        "",
        "yes",
        "yes",
        "yes",
        "yes",
        "New India Assurance",
        "POL-LEN-3391",
        "2024-07-03",
        "2025-07-02",
        4100,
        "Transit damage",
        "yes",
        "yes",
        "yes",
        "yearly",
        "",
        "yes",
    ],
]


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


def _is_truthy(value: Any) -> bool:
    normalized = _normalized_lower(value)
    return normalized in {"true", "1", "yes", "y", "on"}


def _to_number(value: Any) -> float | None:
    if value is None:
        return None
    text = _text(value)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _to_int(value: Any) -> int | None:
    number = _to_number(value)
    if number is None:
        return None
    return int(number)


def _to_iso_date_text(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            pass
    text = _text(value)
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text)
        return parsed.date().isoformat()
    except ValueError:
        return text


def _to_excel_suggestion(row: dict[str, Any], row_number: int, duplicate_asset_id: str | None) -> dict[str, Any]:
    warranty_available = _is_truthy(row.get("warranty_available"))
    insurance_available = _is_truthy(row.get("insurance_available"))
    service_required = _is_truthy(row.get("service_required"))

    warranty = {
        "available": warranty_available,
        "provider": _text(row.get("warranty_provider")) or None,
        "type": _text(row.get("warranty_type")) or "manufacturer",
        "start_date": _to_iso_date_text(row.get("warranty_start_date")),
        "end_date": _to_iso_date_text(row.get("warranty_end_date")),
        "notes": _text(row.get("warranty_notes")) or None,
        "reminders": {
            "thirty_days_before": _is_truthy(row.get("warranty_reminder_30_days")),
            "seven_days_before": _is_truthy(row.get("warranty_reminder_7_days")),
            "on_expiry": _is_truthy(row.get("warranty_reminder_on_expiry")),
        },
    }

    insurance = {
        "available": insurance_available,
        "provider": _text(row.get("insurance_provider")) or None,
        "policy_number": _text(row.get("insurance_policy_number")) or None,
        "start_date": _to_iso_date_text(row.get("insurance_start_date")),
        "expiry_date": _to_iso_date_text(row.get("insurance_expiry_date")),
        "premium_amount": _to_number(row.get("insurance_premium_amount")),
        "coverage_notes": _text(row.get("insurance_coverage_notes")) or None,
        "reminders": {
            "forty_five_days_before": _is_truthy(row.get("insurance_reminder_45_days")),
            "fifteen_days_before": _is_truthy(row.get("insurance_reminder_15_days")),
        },
    }

    service = {
        "required": service_required,
        "frequency": _text(row.get("service_frequency")) or "monthly",
        "custom_interval_days": _to_int(row.get("service_custom_interval_days")),
        "reminder_enabled": _is_truthy(row.get("service_reminder_enabled")),
    }

    now = datetime.now(timezone.utc)
    status = "duplicate" if duplicate_asset_id else "new"
    return {
        "id": f"excel-row-{row_number}",
        "product_name": _text(row.get("product_name")) or f"Asset Row {row_number}",
        "brand": _text(row.get("brand")) or None,
        "vendor": _text(row.get("vendor")) or None,
        "price": _to_number(row.get("price")),
        "purchase_date": _to_iso_date_text(row.get("purchase_date")),
        "sender": "Excel Upload",
        "subject": "Bulk Asset Import",
        "email_date": now.isoformat(),
        "quantity": 1,
        "source": "excel",
        "status": status,
        "warranty": _text(row.get("warranty_notes")) or None,
        "email_message_id": f"excel-upload-{row_number}",
        "attachment_filename": None,
        "attachment_mime_type": None,
        "action_options": ["add", "skip"],
        "already_added": bool(duplicate_asset_id),
        "created_at": now.isoformat(),
        "category": _text(row.get("category")) or "Other",
        "subcategory": _text(row.get("subcategory")) or "Custom Asset",
        "serial_number": _text(row.get("serial_number")) or None,
        "model_number": _text(row.get("model_number")) or None,
        "invoice_number": _text(row.get("invoice_number")) or None,
        "description": _text(row.get("description")) or None,
        "notes": _text(row.get("notes")) or None,
        "location": _text(row.get("location")) or None,
        "assigned_user": _text(row.get("assigned_user")) or None,
        "warranty_details": warranty if warranty_available else None,
        "insurance_details": insurance if insurance_available else None,
        "service_details": service if service_required else None,
        "asset_id": duplicate_asset_id,
    }


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


@router.get("/excel/template")
async def download_excel_template(current_user: dict[str, str] = Depends(get_current_user)):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Assets"
    sheet.append(EXCEL_TEMPLATE_COLUMNS)

    for row in EXCEL_TEMPLATE_SAMPLE_ROWS:
        sheet.append(row)

    payload = BytesIO()
    workbook.save(payload)
    payload.seek(0)

    return StreamingResponse(
        BytesIO(payload.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="asset_upload_template.xlsx"'},
    )


@router.post("/excel/upload")
async def upload_excel_file(
    file: UploadFile = File(...),
    current_user: dict[str, str] = Depends(get_current_user),
    db=Depends(get_db),
) -> dict[str, Any]:
    file_name = (file.filename or "").lower()
    if not file_name.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        workbook = load_workbook(filename=BytesIO(content), data_only=True)
    except Exception as error:
        raise HTTPException(status_code=400, detail="Invalid Excel file") from error

    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(status_code=400, detail="Excel sheet is empty")

    headers = [_normalized_lower(header) for header in (rows[0] or [])]
    missing_headers = [column for column in EXCEL_TEMPLATE_COLUMNS if column not in headers]
    if missing_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Template columns missing: {', '.join(missing_headers)}",
        )

    header_index = {column: headers.index(column) for column in EXCEL_TEMPLATE_COLUMNS}
    suggestions: list[dict[str, Any]] = []
    skipped_rows: list[dict[str, Any]] = []

    for index, excel_row in enumerate(rows[1:], start=2):
        row_map: dict[str, Any] = {}
        for column in EXCEL_TEMPLATE_COLUMNS:
            position = header_index[column]
            row_map[column] = excel_row[position] if position < len(excel_row) else None

        if not any(_text(value) for value in row_map.values()):
            continue

        if not _text(row_map.get("product_name")):
            skipped_rows.append({"row_number": index, "reason": "product_name is required"})
            continue

        duplicate = await _find_duplicate_asset(
            {
                "name": row_map.get("product_name"),
                "vendor": row_map.get("vendor"),
                "purchase_date": _to_iso_date_text(row_map.get("purchase_date")),
                "invoice_number": row_map.get("invoice_number"),
            },
            current_user["id"],
            db,
        )

        duplicate_asset_id = str(duplicate.get("_id")) if duplicate else None
        suggestion = _to_excel_suggestion(row_map, index, duplicate_asset_id)
        suggestions.append(suggestion)

    return {
        "file_name": file.filename,
        "total_rows": max(len(rows) - 1, 0),
        "parsed_rows": len(suggestions),
        "skipped_rows": skipped_rows,
        "suggestions": suggestions,
    }


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
