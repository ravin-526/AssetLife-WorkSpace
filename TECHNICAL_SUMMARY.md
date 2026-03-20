# AssetLife — Comprehensive Technical Summary

> **Last updated:** current session  
> This document is the canonical developer reference for the AssetLife workspace. It covers all 14 technical dimensions of the project. Keep it updated whenever significant architectural changes are made.

---

## 1. Project Overview

**AssetLife** is a personal asset lifecycle management platform. It allows individual users to track, manage, and receive reminders about their owned assets throughout their full lifecycle (purchase → warranty → insurance → service → disposal).

### Core Capabilities
| Capability | Description |
|---|---|
| Asset CRUD | Create, read, update, delete physical and financial assets |
| Email Sync | Connect Gmail, scan invoices from emails, auto-generate asset suggestions |
| Excel Upload | Bulk asset import via downloadable template |
| Invoice Upload | Upload invoice PDFs/images; OCR extraction of asset metadata |
| Barcode/QR Scan | Scan-to-add asset creation entry point (frontend UI only, mobile-ready intent) |
| Lifecycle Tracking | Warranty, insurance, and service schedule fields per asset |
| Reminders | Date-based reminders tied to asset lifecycle events |
| Document Management | Attach and retrieve documents per asset |
| Category System | 12 top-level categories with typed subcategories; seeded on startup |
| User Management | Admin/super-admin CRUD over user accounts; role-based access |
| OTP Auth | 6-digit OTP-based login for individual users |

### Three-Tier Workspace
```
assetlife-workspace/
├── backend/   Python FastAPI + Motor + MongoDB
├── webapp/    React 18 + TypeScript + MUI + Zustand
└── mobile/    Flutter/Dart scaffold (placeholder — not functional)
```

---

## 2. Project Structure

### Full Directory Tree

```
assetlife-workspace/
├── PROJECT_RULES.md          Legacy/partial summary (outdated — see this file)
├── TECHNICAL_SUMMARY.md      Canonical reference (this document)
├── README.md
│
├── backend/
│   ├── requirements.txt
│   ├── .env                  Backend environment config (gitignored)
│   ├── logs/                 Loguru log output
│   ├── uploads/
│   │   ├── invoices/         Uploaded invoice files (PDFs, images)
│   │   └── documents/        Asset document attachments
│   └── app/
│       ├── main.py           FastAPI app entrypoint (CORS, routers, startup)
│       ├── api/
│       │   └── dependencies.py  (EMPTY — reserved file, no content)
│       ├── core/
│       │   ├── config.py     Pydantic-settings environment loader
│       │   ├── constants.py  Shared constants
│       │   ├── crypto.py     AES field encryption + SHA-256 hash helpers
│       │   ├── exceptions.py Typed API exception hierarchy + global handlers
│       │   ├── hash.py       Hashing utilities
│       │   ├── jwt.py        JWT creation/verification (HS256)
│       │   ├── logger.py     Loguru logger setup
│       │   ├── logging.py    Additional logging config
│       │   ├── security.py   JWT Bearer auth dependency + require_roles factory
│       │   └── status_master.py  Default asset status seeding
│       ├── db/
│       │   ├── base.py       Base DB helpers
│       │   ├── indexes.py    Startup index creation + duplicate cleanup
│       │   ├── mongo.py      MongoManager class + get_db dependency
│       │   ├── mongodb.py    Additional MongoDB utilities
│       │   └── session.py    Session-scoped DB helpers
│       ├── exceptions/
│       │   ├── custom_exceptions.py  Domain-specific exceptions
│       │   └── handlers.py   FastAPI exception handler registration
│       ├── models/
│       │   ├── role.py       Role enum (SUPER_ADMIN, ADMIN, INDIVIDUAL)
│       │   └── user.py       User domain model
│       ├── routers/
│       │   └── individual.py  ORPHANED — stale duplicate, not imported
│       ├── routes/            ACTIVE route modules
│       │   ├── auth.py
│       │   ├── individual.py
│       │   ├── user.py
│       │   ├── assets.py
│       │   ├── asset_suggestions.py
│       │   ├── categories.py
│       │   ├── email_scans.py
│       │   ├── gmail_integration.py
│       │   ├── reminders.py
│       │   ├── statuses.py
│       │   └── testing.py    ⚠ TEMPORARY — remove before production
│       ├── schemas/
│       │   ├── user.py       User request/response Pydantic schemas
│       │   └── gmail_import.py  Gmail/asset suggestion schemas
│       └── services/
│           ├── asset_suggestion_service.py  Suggestion lifecycle logic
│           ├── email_scan_service.py        Gmail message fetch + parse
│           ├── gmail_service.py             Gmail OAuth2 token management
│           ├── invoice_parser.py            PDF/image OCR extraction
│           ├── otp_service.py               In-memory OTP store
│           └── user_service.py              User CRUD + auth + PII encryption
│
├── webapp/
│   ├── package.json
│   ├── .env                  Frontend environment config (gitignored)
│   ├── public/
│   ├── build/                Production build output (gitignored)
│   └── src/
│       ├── index.tsx         App entry point — mounts App.tsx
│       ├── App.tsx           ✅ ACTIVE runtime router and app shell
│       ├── AppRoutes.tsx     ⚠ LEGACY — not active, kept for reference
│       ├── api/
│       │   ├── auth.ts       Auth API call wrappers
│       │   └── axiosInstance.ts  Re-exports api.ts axios instance
│       ├── components/
│       │   ├── AdminLayout.tsx  Main app shell with sidebar nav
│       │   ├── OtpInput.tsx     OTP digit input component
│       │   ├── PrivateRoute.tsx Route guard (redirects to /login if no token)
│       │   └── modules/
│       │       ├── AssetPreviewModal.tsx  ✅ Asset preview/edit popup
│       │       └── ...
│       ├── constants/
│       │   └── logo.ts
│       ├── features/         ⚠ LEGACY — all files marked "Legacy component"
│       │   ├── auth/
│       │   └── dashboard/
│       ├── hooks/
│       │   └── useAutoDismissMessage.ts
│       ├── pages/            ✅ ACTIVE page components
│       │   ├── IndividualLogin.tsx
│       │   ├── IndividualRegister.tsx
│       │   ├── Dashboard.tsx
│       │   ├── AddAsset.tsx
│       │   ├── Assets.tsx
│       │   ├── AssetView.tsx
│       │   ├── AssetSuggestions.tsx
│       │   ├── EmailIntegrations.tsx
│       │   ├── EmailScans.tsx
│       │   ├── Reminders.tsx
│       │   ├── Reports.tsx         ⚠ Empty content placeholder
│       │   ├── Users.tsx
│       │   ├── Profile.tsx
│       │   └── Settings.tsx
│       ├── routes/
│       ├── services/
│       │   ├── api.ts        Axios instance + auth interceptors
│       │   ├── gmail.ts      All asset/suggestion/Gmail API calls + TypeScript types
│       │   └── reminders.ts  Reminder API calls
│       ├── store/
│       │   └── userStore.ts  Zustand auth store
│       ├── styles/
│       │   ├── theme.ts
│       │   └── theme.js
│       └── utils/
│           └── assetStatus.ts
│
└── mobile/
    ├── pubspec.yaml          EMPTY — not configured
    └── lib/
        ├── main.dart         EMPTY — not functional
        └── features/
            ├── asset/asset_routes.dart
            └── auth/auth_routes.dart
```

---

## 3. Backend Architecture

### Technology Stack
| Component | Library / Version |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI |
| ASGI Server | Uvicorn |
| DB Driver | Motor (async MongoDB) |
| ODM / Validation | Pydantic v2 + pydantic-settings |
| JWT | python-jose (HS256) |
| Password Hashing | passlib[bcrypt] |
| Field Encryption | cryptography (AES) |
| Logging | loguru |
| Excel Parsing | openpyxl |
| PDF/OCR | PyPDF2, Pillow, pytesseract |
| HTTP Client | httpx |
| Database | MongoDB (database name: `assetlife`) |

### Application Lifecycle (`main.py`)
1. FastAPI app created
2. CORS middleware registered — `allow_origins=["http://localhost:3000"]`, all methods, all headers, credentials allowed
3. Exception handlers registered
4. All 11 routers included
5. **Startup**: Connect MongoDB → ensure indexes → seed default statuses
6. **Shutdown**: Disconnect MongoDB

### Layered Architecture
```
HTTP Request
    ↓
CORS Middleware
    ↓
JWT Bearer Auth (security.py → get_current_user)
    ↓
Router (routes/*.py) — validates request, delegates to service
    ↓
Service (services/*.py) — business logic, DB calls
    ↓
MongoDB (via Motor async driver)
```

### Error Response Format
All errors return a consistent JSON envelope:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### Exception Types
| Class | HTTP Status |
|---|---|
| `BadRequestError` | 400 |
| `AuthenticationError` | 401 |
| `AuthorizationError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| Unhandled exception | 500 (`INTERNAL_SERVER_ERROR`) |

---

## 4. API Endpoints

All endpoints are served from the FastAPI backend (default: `http://localhost:8000`).

### Authentication — `/auth`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/auth/login/admin` | No | Admin login with username + password; returns JWT |
| POST | `/auth/login/individual` | No | Legacy individual login (uses static OTP code) |
| POST | `/auth/send-otp` | No | Send OTP for individual login (prints to terminal) |
| POST | `/auth/verify-otp` | No | Verify OTP; returns JWT |

### Individual Users — `/individual`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/individual/register` | No | Register new individual user |
| POST | `/individual/send-otp` | No | Send OTP (prints to terminal in dev) |
| POST | `/individual/verify-otp` | No | Verify OTP; returns JWT |
| GET | `/individual/profile` | JWT | Get own profile |
| PUT | `/individual/update` | JWT | Update own profile |

### Admin Users — `/users`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/users` | SUPER_ADMIN / ADMIN | Create user |
| GET | `/users` | SUPER_ADMIN / ADMIN | List all users |
| GET | `/users/{user_id}` | JWT (self or admin) | Get user by ID |
| PUT | `/users/{user_id}` | JWT (self or admin) | Update user |
| DELETE | `/users/{user_id}` | SUPER_ADMIN | Delete user |

### Assets — `/api/assets`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/assets` | JWT | List authenticated user's assets |
| POST | `/api/assets` | JWT | Create new asset |
| GET | `/api/assets/{asset_id}` | JWT | Get single asset |
| PUT | `/api/assets/{asset_id}` | JWT | Update asset |
| DELETE | `/api/assets/{asset_id}` | JWT | Delete asset (+ associated files) |
| GET | `/api/assets/{asset_id}/invoice` | JWT | Stream invoice file |
| POST | `/api/assets/{asset_id}/documents` | JWT | Upload document(s) to asset |
| GET | `/api/assets/{asset_id}/documents` | JWT | List asset documents |
| GET | `/api/assets/{asset_id}/documents/{document_id}/file` | JWT | Stream document file |
| DELETE | `/api/assets/{asset_id}/documents/{document_id}` | JWT | Delete document |
| GET | `/api/assets/excel/template` | JWT | Download Excel upload template |
| POST | `/api/assets/excel/upload` | JWT | Bulk import assets from Excel file |

### Asset Suggestions — `/api/assets/suggestions`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/assets/suggestions` | JWT | List pending suggestions for user |
| POST | `/api/assets/suggestions/clear-temp` | JWT | Clear temporary/rejected suggestions |
| POST | `/api/assets/suggestions/{suggestion_id}/parse` | JWT | Parse invoice attachment; enrich suggestion fields |
| POST | `/api/assets/suggestions/{suggestion_id}/reject` | JWT | Reject suggestion |
| POST | `/api/assets/suggestions/{suggestion_id}/confirm` | JWT | Confirm suggestion → creates asset |
| GET | `/api/assets/suggestions/{suggestion_id}/email` | JWT | Get original email details for suggestion |
| GET | `/api/assets/suggestions/{suggestion_id}/attachment` | JWT | Stream suggestion invoice attachment |

### Email Scans
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/emails` | JWT | List scanned email records |
| POST | `/api/email/scan` | JWT | Trigger Gmail sync; create suggestions from new emails |

### Gmail Integration — `/api/integrations/gmail`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/integrations/gmail/status` | JWT | Check Gmail connection status |
| POST | `/api/integrations/gmail/connect` | JWT | Initiate Gmail OAuth2 flow; returns redirect URL |
| POST | `/api/integrations/gmail/callback` | JWT | Handle OAuth2 callback (API POST variant) |
| GET | `/api/integrations/gmail/callback` | No | Handle OAuth2 browser redirect callback |
| POST | `/api/integrations/gmail/disconnect` | JWT | Disconnect Gmail; delete stored tokens |

### Categories — `/api/categories`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/categories` | JWT | List all categories (with subcategories) |
| POST | `/api/categories` | JWT | Create category |
| GET | `/api/categories/{category_id}/subcategories` | JWT | List subcategories for category |
| POST | `/api/categories/{category_id}/subcategories` | JWT | Add subcategory |

### Reminders — `/api/reminders`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/reminders` | JWT | List user's reminders |
| POST | `/api/reminders` | JWT | Create reminder |
| PUT | `/api/reminders/{reminder_id}` | JWT | Update reminder |
| DELETE | `/api/reminders/{reminder_id}` | JWT | Delete reminder |

### Statuses — `/api/statuses`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| GET | `/api/statuses` | JWT | List all asset statuses |

### Testing — `/api/testing`
| Method | Path | Auth Required | Description |
|---|---|---|---|
| POST | `/api/testing/reset-user-data` | JWT | ⚠ **TEMPORARY** — Wipe all user data; remove before production |

---

## 5. Database Design

### Database Name
`assetlife` (configured via `MONGODB_DB` in `.env`)

### Collections

#### `users`
Admin and super-admin accounts.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `username` | String | Unique |
| `password` | String | bcrypt hash |
| `role` | String | `"admin"` or `"super_admin"` |
| `created_at` | DateTime | |

#### `individual_users`
End-user accounts. PII fields are AES-encrypted at rest.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | String | **AES encrypted** |
| `mobile` | String | **AES encrypted** |
| `mobile_hash` | String | SHA-256 hash of mobile; used for lookup |
| `dob` | String | **AES encrypted** |
| `pan` | String | **AES encrypted** |
| `is_verified` | Bool | Set `true` after OTP success |
| `created_at` | DateTime | |

**Index**: `mobile_hash` (unique)

#### `assets`
Core asset records.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `user_id` | String | Owner's individual user ID |
| `name` | String | |
| `category` | String | |
| `subcategory` | String | |
| `brand` | String | |
| `model` | String | |
| `serial_number` | String | |
| `purchase_date` | String | |
| `purchase_price` | Number | |
| `status` | String | |
| `warranty` | Object | `{available, end_date, ...}` |
| `insurance` | Object | `{available, expiry_date, ...}` |
| `service` | Object | `{required, next_service_date, ...}` |
| `invoice_path` | String | Relative path in `uploads/invoices/` |
| `notes` | String | |
| `created_at` | DateTime | |

**Indexes**: `user_id`, `category`, `subcategory`

#### `asset_suggestions`
Email-derived asset candidates awaiting user review.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `user_id` | String | |
| `email_message_id` | String | Gmail message ID (deduplication) |
| `status` | String | `"pending"`, `"confirmed"`, `"rejected"`, `"temp"` |
| `attachment_filename` | String | Original email attachment filename |
| `attachment_mime_type` | String | MIME type of attachment |
| `invoice_attachment_path` | String | Saved path in `uploads/invoices/` |
| `parsed_fields` | Object | OCR-extracted asset metadata |
| `raw_email_data` | Object | Raw Gmail message metadata |
| `created_at` | DateTime | |

**Indexes**: `(user_id, status)` compound, `email_message_id`

#### `asset_documents`
Files attached to assets (separate from purchase invoices).
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `asset_id` | String | |
| `user_id` | String | |
| `filename` | String | Original filename |
| `file_path` | String | Path in `uploads/documents/` |
| `file_type` | String | MIME type |
| `created_at` | DateTime | |

#### `email_scans`
Record of every Gmail message that was processed.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `user_id` | String | |
| `gmail_message_id` | String | |
| `subject` | String | |
| `sender` | String | |
| `scan_date` | DateTime | |
| `has_suggestion` | Bool | |

**Index**: `(user_id, gmail_message_id)` unique compound

#### `gmail_integrations`
Gmail OAuth2 tokens per user.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `user_id` | String | |
| `provider` | String | `"gmail"` |
| `access_token` | String | **Encrypted** |
| `refresh_token` | String | **Encrypted** |
| `token_expiry` | DateTime | |
| `connected_at` | DateTime | |

**Index**: `(user_id, provider)` unique compound

#### `reminders`
User-created date-based reminders.
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `user_id` | String | |
| `asset_id` | String | Optional — link to asset |
| `title` | String | |
| `reminder_date` | DateTime | |
| `is_active` | Bool | |

**Index**: `(user_id, reminder_date)` compound

#### `categories` / `subcategories`
Master data for asset classification.

**Indexes**: `categories.category` (unique), `subcategories.(category_id, name)` (unique compound)

#### `status_master`
Master list of asset status values; seeded on startup.
Default values: `Active`, `In Warranty`, `Expired`, `Expiring Soon`, `Inactive`, `Lost`, `Damaged`

**Index**: `name` (unique)

---

## 6. Data Flow

### 6.1 Individual User Login (OTP Flow)

```
Browser                    Frontend                   Backend
  |                           |                          |
  |── Enter mobile number ───>|                          |
  |                           |── POST /individual/send-otp ──>|
  |                           |                          |── Validate mobile exists
  |                           |                          |── Generate random 6-digit OTP
  |                           |                          |── Store in memory (30s TTL)
  |                           |                          |── Print OTP to terminal (dev)
  |                           |<── 200 OK ───────────────|
  |── Enter OTP from terminal>|                          |
  |                           |── POST /individual/verify-otp ──>|
  |                           |                          |── Validate OTP (TTL, value)
  |                           |                          |── Mark user is_verified=true
  |                           |                          |── Create JWT (HS256, 60 min)
  |                           |<── { token } ────────────|
  |                           |── Store token in Zustand + localStorage
  |<── Redirect /dashboard ───|
```

### 6.2 Gmail Email Sync → Asset Suggestion

```
User clicks "Sync Emails" in EmailScans page
    ↓
POST /api/email/scan
    ↓ email_scan_service.py
Fetch Gmail messages using stored OAuth2 tokens
    ↓
For each message with invoice attachment:
    - Check email_scans for duplicate (gmail_message_id)
    - Save attachment to uploads/invoices/
    - Create asset_suggestions document (status="pending")
    - Create email_scans record
    ↓
Return GmailSyncResponse { new_suggestions_count, ... }
```

### 6.3 Asset Suggestion Review → Asset Creation

```
User opens AddAsset → Email Sync tab
    ↓
GET /api/assets/suggestions  →  Load pending suggestions grid
    ↓
User clicks "+" on a suggestion row
    ↓  (handlePrepareSave - AddAsset.tsx)
POST /api/assets/suggestions/{id}/parse  →  OCR invoice attachment
    ↓  invoice_parser.py
PyPDF2 / pytesseract extracts: name, brand, price, dates, category
    ↓
AssetPreviewModal opens with enriched parsed_fields + attachment blob
    ↓  (GET /api/assets/suggestions/{id}/attachment)
User reviews/edits fields, clicks "Save Asset"
    ↓
POST /api/assets/suggestions/{id}/confirm
    ↓  asset_suggestion_service.py
Create asset document in assets collection
Update suggestion status = "confirmed"
    ↓
Asset appears in user's Assets list
```

### 6.4 Direct Asset Creation (Manual Entry / Excel / Invoice Upload)

```
POST /api/assets  (multipart/form-data when invoice attached)
    ↓
Save invoice file to uploads/invoices/{uuid}_{filename}
Insert asset document into assets collection
Return created asset with _id
```

### 6.5 Frontend API Request Flow

```
React Component
    ↓
Service function (services/gmail.ts or reminders.ts)
    ↓
Axios instance (services/api.ts)
    ├── Request interceptor: inject Authorization: Bearer <token>
    ↓
Backend FastAPI handler
    ↓
Response interceptor (on 401): logout() + redirect to /login
```

---

## 7. Frontend Architecture

### Technology Stack
| Library | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 4.9 | Type safety |
| React Router | v6 | Client-side routing |
| MUI (Material UI) | v7 + Emotion | Component library + styling |
| Zustand | v5 | Global state (auth) |
| Axios | 1.7 | HTTP client |
| Recharts | 3.8 | Dashboard charts |
| PrimeReact | imported | Minimal usage (some data grids) |
| Create React App | 5 (react-scripts) | Build tooling |

### State Management
**Zustand store** (`store/userStore.ts`):
- Persists JWT to `localStorage` key `access_token` (migrates from legacy key `jwt_token`)
- Actions: `login(token, userData)`, `logout()`, `updateUser()`
- `logout()` clears token from both store and localStorage then navigates to `/login`

### Active vs Legacy Code
| Path | Status |
|---|---|
| `src/App.tsx` | ✅ **Active** — runtime router, imported by `index.tsx` |
| `src/pages/` | ✅ **Active** — all current page components |
| `src/components/` | ✅ **Active** — shared components |
| `src/services/` | ✅ **Active** — API service layer |
| `src/AppRoutes.tsx` | ⚠ **Legacy** — not imported anywhere active |
| `src/features/` | ⚠ **Legacy** — all files contain "Legacy component" comment |

### Key Components
**`AdminLayout.tsx`**: Main app shell
- Collapsible sidebar with sections: Dashboard, Assets (expandable), Email Integration, Email Scans, Reminders, Reports, Users, Profile, Settings
- Assets submenu: Email Sync, Invoice Upload, Excel Upload, Barcode/QR, Manual Entry → all open `AddAsset.tsx` with tab pre-selected
- Top bar: theme toggle, user profile menu

**`AssetPreviewModal.tsx`**: Asset preview and edit popup
- Used from Email Sync (`AddAsset.tsx`) to review parsed suggestions before saving
- Left panel: editable asset fields (name, category, brand, price, lifecycle dates)
- Right panel: attachment invoice preview (PDF/image blob) or email preview
- **Critical**: Effect for loading attachment blob must NOT include `attachmentUrl` in its dependency array (causes infinite re-render loop; see Section 14)

**`PrivateRoute.tsx`**: Route guard
- Reads token from Zustand; if absent, redirects to `/login`

---

## 8. Application Navigation

### Public Routes
| Path | Component | Description |
|---|---|---|
| `/login` | `IndividualLogin.tsx` | OTP-based login |
| `/register` | `IndividualRegister.tsx` | New account registration |

### Protected Routes (under `AdminLayout` + `PrivateRoute`)
| Path | Component | Description |
|---|---|---|
| `/dashboard` | `Dashboard.tsx` | Asset summary charts, recent activity |
| `/integrations/email` | `EmailIntegrations.tsx` | Connect/disconnect Gmail |
| `/emails` | `EmailScans.tsx` | View scanned emails, trigger sync |
| `/assets/suggestions` | `AssetSuggestions.tsx` | Review pending asset suggestions |
| `/assets` | `Assets.tsx` | Full asset list with filter/search |
| `/assets/add` | `AddAsset.tsx` | Multi-tab asset creation hub |
| `/assets/:assetId` | `AssetView.tsx` | Single asset detail + lifecycle view |
| `/reminders` | `Reminders.tsx` | Manage date-based reminders |
| `/reports` | `Reports.tsx` | ⚠ Placeholder — empty content |
| `/users` | `Users.tsx` | Admin: manage platform users |
| `/profile` | `Profile.tsx` | Edit own profile |
| `/settings` | `Settings.tsx` | App settings + ⚠ TEMPORARY reset button |

---

## 9. Business Logic

### Asset Status Computation
Asset statuses are stored in `status_master` collection and seeded at startup:
- **Active** — default state after creation
- **In Warranty** — warranty.available=true and within expiry
- **Expiring Soon** — warranty/insurance expiring within threshold window
- **Expired** — warranty/insurance past end date
- **Inactive** — manually set
- **Lost** / **Damaged** — manually set

Frontend status badge rendering: `utils/assetStatus.ts`

### Asset Lifecycle Fields
Each asset can have three lifecycle objects. These can arrive as **JSON strings or plain objects** depending on the code path — always parse safely:
```typescript
// Safe access pattern
const warranty = typeof asset.warranty === 'string'
  ? JSON.parse(asset.warranty)
  : asset.warranty;
const inWarranty = warranty?.available && !!warranty?.end_date;
```
- **Warranty**: `{ available, end_date / endDate }`
- **Insurance**: `{ available, expiry_date / end_date / endDate }`
- **Service**: `{ required / available, next_service_date / nextServiceDate }`

### Category System
12 top-level categories seeded on startup:
- Electronics, Home Appliances, Personal Gadgets, Furniture, Vehicles, Property & Real Estate, Financial Assets, Documents, Subscriptions & Services, Jewelry & Valuables, Education, Other

Each non-"Other" category automatically gets an "Other" subcategory appended. Categories are deduplicated case-insensitively.

### OTP Authentication
- **TTL**: 30 seconds
- **Rate limit**: 5 requests per 5 minutes per mobile hash
- **Storage**: In-memory Python dict (singleton `OtpService` instance) — does NOT survive server restart
- **Delivery**: OTP is printed to the backend terminal (development only; no SMS/email service)
- **Verify returns**: `"valid"` | `"not_found"` | `"expired"` | `"invalid"`

### PII Encryption
`user_service.py` encrypts sensitive individual user fields at write time and decrypts at read time:
- **AES encrypted**: `name`, `mobile`, `dob`, `pan`
- **SHA-256 hashed**: `mobile` → stored as `mobile_hash` for DB lookup without decrypting

### Invoice Parsing Pipeline
`invoice_parser.py`:
1. Receive file path of uploaded invoice
2. Detect type: PDF vs image
3. PDF: PyPDF2 text extraction → regex patterns for brand, price, date, category
4. Image: Pillow open → pytesseract OCR → same regex extraction
5. Return structured `parsed_fields` dict

### Gmail OAuth2 Token Lifecycle
`gmail_service.py`:
1. `connect()` → generate Google OAuth2 authorization URL (scope: `gmail.readonly`)
2. `callback()` → exchange code for tokens; encrypt and store in `gmail_integrations`
3. On each sync → load tokens, refresh if expired, re-encrypt updated tokens
4. `disconnect()` → delete `gmail_integrations` document for user

---

## 10. External Integrations

### Gmail (Google OAuth2)
- **Scopes**: `https://www.googleapis.com/auth/gmail.readonly`
- **OAuth flow**: Standard authorization code flow; callback handled at `GET /api/integrations/gmail/callback`
- **Token storage**: Encrypted in MongoDB `gmail_integrations` collection
- **Sync operation**: Fetches recent messages, filters for purchase/invoice emails, downloads attachments
- **Config keys**: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`

### File Storage
- **Type**: Local filesystem (not cloud storage — no S3/GCS integration)
- **Invoice files**: `backend/uploads/invoices/`
- **Asset documents**: `backend/uploads/documents/`
- **File paths** stored relative to `uploads/` in database fields
- **Access**: Files streamed back as `FileResponse` with proper MIME type

### No Active Third-Party Services
- No SMS provider (OTP goes to terminal only)
- No email delivery service
- No push notifications
- No external analytics

---

## 11. Environment Configuration

### Backend (`backend/.env`)
```env
APP_NAME=AssetLife
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=assetlife
JWT_SECRET_KEY=<your-secret-key>
ACCESS_TOKEN_EXPIRE_MINUTES=60
ENCRYPTION_KEY=<your-32-byte-base64-aes-key>
OTP_STATIC_CODE=123456
FRONTEND_APP_URL=http://localhost:3000
GMAIL_CLIENT_ID=<google-oauth-client-id>
GMAIL_CLIENT_SECRET=<google-oauth-client-secret>
GMAIL_REDIRECT_URI=http://localhost:8000/api/integrations/gmail/callback
```

### Frontend (`webapp/.env`)
```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

### Key Notes
- `OTP_STATIC_CODE=123456` is used only by the legacy `/auth/login/individual` path in `user_service.authenticate_individual()`. The active `/individual/verify-otp` flow uses the in-memory OTP store with random codes.
- `ENCRYPTION_KEY` must be a valid 32-byte base64-encoded key for AES-256 encryption.
- The Axios fallback base URL in `services/api.ts` was previously `http://192.168.0.14:8000` (LAN IP) — ensure the `.env` is set correctly for all environments.

---

## 12. Security

### Authentication
- **JWT**: HS256 signing, 60-minute expiry. Decoded by `core/security.py → get_current_user()` on every protected request.
- **OTP**: Random 6-digit codes with 30-second TTL and per-mobile rate limiting. In-memory only (not persistent).
- **Admin passwords**: bcrypt-hashed; verified by `UserService.authenticate_admin()`.

### Authorization
- Role-based via `require_roles(*roles)` FastAPI dependency factory.
- Roles: `SUPER_ADMIN`, `ADMIN`, `INDIVIDUAL`
- Asset endpoints scope data to authenticated user's `user_id` — users cannot access other users' assets.
- Document and suggestion endpoints also scoped to `user_id`.

### Data Protection
- **PII encryption at rest**: `name`, `mobile`, `dob`, `pan` in `individual_users` are AES-encrypted in MongoDB. Decrypted only in service layer, never returned as raw ciphertext.
- **Gmail tokens encrypted**: OAuth2 access/refresh tokens encrypted before DB storage.
- **Mobile lookup**: Uses SHA-256 hash (`mobile_hash`) so the server never needs to decrypt to find a user.

### Frontend Security
- Token stored in `localStorage` (standard SPA pattern). Interceptor injects it as `Authorization: Bearer` header.
- 401 responses trigger auto-logout to prevent stale session use.
- Route guard (`PrivateRoute`) prevents access to protected pages without a token.

### Known Concerns
- CORS is currently restricted to `http://localhost:3000` only — good for development, must be updated for production deployment with actual domain.
- OTP has no persistence — server restart invalidates all pending OTPs.
- File upload directory (`uploads/`) must not be web-accessible without authentication. Files are accessed only through authenticated API endpoints — do not expose `uploads/` directly via static file serving.
- No CSRF protection currently in place (JWT in Authorization header mitigates most CSRF risk, but worth auditing for sensitive mutation endpoints).

---

## 13. Current Limitations and TODOs

### ⚠ Temporary Features (Must Remove Before Production)
| Location | Description |
|---|---|
| `backend/app/routes/testing.py` | `POST /api/testing/reset-user-data` — wipes all user data |
| `webapp/src/pages/Settings.tsx:31` | "Reset Data" button that calls the above endpoint |

Both have the comment `# TEMPORARY TESTING FEATURE: remove before production deployment`.

### Empty / Placeholder Content
| Item | Status |
|---|---|
| `webapp/src/pages/Reports.tsx` | Empty page — no chart/report content implemented |
| `mobile/lib/main.dart` | Empty file — Flutter app is not functional |
| `mobile/pubspec.yaml` | Empty — no dependencies configured |
| `backend/app/api/dependencies.py` | Empty — reserved but unused |

### Legacy / Dead Code (Safe to Delete)
| Path | Reason |
|---|---|
| `webapp/src/AppRoutes.tsx` | Not imported; marked as "Legacy router kept for reference only" |
| `webapp/src/features/auth/` | All files marked "Legacy feature component" |
| `webapp/src/features/dashboard/` | All files marked "Legacy feature component" |
| `backend/app/routers/individual.py` | In `routers/` (not `routes/`); orphaned, not imported in `main.py` |

### Unimplemented / Partial Features
- **OTP delivery**: Not connected to any SMS or email provider. For production, integrate Twilio, AWS SNS, or similar.
- **Reports page**: Completely empty. No analytics/export features implemented.
- **Mobile app**: Empty Flutter scaffold. No authentication, asset listing, or any screen implemented.
- **Barcode/QR scan**: Entry point exists in sidebar but functionality depends on mobile or webcam API.

### Authentication Dual-Path Inconsistency
Two OTP flows exist with different implementations:
- `/auth/send-otp` + `/auth/verify-otp` — one implementation in `auth.py`
- `/individual/send-otp` + `/individual/verify-otp` — separate implementation in `individual.py`

Additionally, `UserService.authenticate_individual()` (called by `/auth/login/individual`) still compares against `settings.OTP_STATIC_CODE` — this is a legacy code path that should be removed.

---

## 14. Development Notes

### Critical: Known Bugs Fixed This Session

#### `AssetPreviewModal.tsx` — Attachment Preview Effect Dependencies
**Do not** add `attachmentUrl` to the dependency array of the `useEffect` that calls `setAttachmentUrl(...)`. Doing so creates an infinite re-render loop:
```
setAttachmentUrl → attachmentUrl changes → effect re-runs → revoke + refetch → setAttachmentUrl → ...
```

**Correct pattern** — deps must be stable attachment identity keys only:
```typescript
useEffect(() => {
  // ... fetch blob, create object URL
  setAttachmentUrl((prev) => {
    if (prev) URL.revokeObjectURL(prev);  // revoke old without needing dep
    return newObjectUrl;
  });
}, [
  suggestion?.id,
  suggestion?.attachment_filename,
  suggestion?.attachment_mime_type,
  suggestion?.invoice_attachment_path,
  open, rightPanelTab, disableAttachmentAndEmailPreview
]);
// ← attachmentUrl is NOT in this array
```

#### `backend/app/routes/assets.py` — Risk of Accidental Duplication
This file has previously had its full module content duplicated accidentally (likely via editor paste/merge). If asset behavior looks inconsistent, verify the file is not duplicated. Check for duplicate function definitions with `grep -n "^@router\." backend/app/routes/assets.py | sort`.

### Logger Extra Field Warning
**Do not** use reserved Python `LogRecord` attribute names as keys in loguru `extra` dictionaries. Example reserved names: `filename`, `lineno`, `funcName`, `module`, `levelname`, `message`, `name`, `pathname`, `process`, `thread`.

Using reserved keys raises `KeyError` during log emission and silently stops suggestion creation for the affected email:
```python
# BAD — 'filename' is a reserved LogRecord key
logger.info("Processing", extra={"filename": attachment.filename})

# GOOD — use a safe custom key
logger.info("Processing", extra={"attachment_name": attachment.filename})
```

### Category/Subcategory Rendering (Frontend)
- Accept both `id` and `_id` from backend payloads
- Guard against null/undefined before rendering MUI `MenuItem` keys
- Disable subcategory dropdown until a category is selected
- Compare selected category names case-insensitively for dependent dropdown filtering

### Asset Lifecycle Data (Frontend)
Lifecycle fields (`warranty`, `insurance`, `service`) can arrive as either JSON strings or plain objects depending on the API path. Always parse defensively:
```typescript
const w = typeof asset.warranty === 'string' ? JSON.parse(asset.warranty) : asset.warranty;
```

### Asset Grid Sticky Actions Column
The Actions column in asset data grids should use:
```css
position: sticky;
right: 0;
width: 140px;   /* fixed, not responsive fraction */
background-color: <theme bgcolor>;
```
This pins the column during horizontal scroll.

### Debug Logs Currently Active (Remove for Production)
The following `console.log` statements were added during debugging and should be removed before production:
| File | Log |
|---|---|
| `webapp/src/pages/AddAsset.tsx` | `console.log("Selected asset data:", suggestion)` (in `handlePrepareSave`) |
| `webapp/src/components/modules/AssetPreviewModal.tsx` | `console.log("Asset in popup:", suggestion)` |
| `webapp/src/components/modules/AssetPreviewModal.tsx` | `console.log("Attachment:", attachmentUrl)` |
| `webapp/src/components/modules/AssetPreviewModal.tsx` | `console.log("Loading:", attachmentLoading)` |

### Running the Project

**Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd webapp
npm start          # development server on port 3000
npm run build      # production build to webapp/build/
```

**Run backend + view OTP in dev:**
OTP codes are printed directly to the backend terminal stdout. Check the terminal running uvicorn to get the OTP after triggering `/individual/send-otp`.

### Build Artifacts (Do Not Commit)
- `webapp/build/` — production build output
- `webapp/node_modules/.cache/babel-loader/` — babel transpile cache
- `backend/__pycache__/` — Python bytecode
- `backend/uploads/` — user-uploaded files (should be gitignored in production)

---

*End of Technical Summary*
