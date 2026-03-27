
# AssetLife Technical Summary


Last updated: 28 March 2026

This document is the authoritative technical reference for the AssetLife repository. It provides a comprehensive, up-to-date overview of the system architecture, backend and frontend modules, API endpoints, database design, business logic, integrations, configuration, and security. Use this as the primary onboarding and reference guide for all future development. All sections are detailed to enable any developer or AI assistant to quickly understand and continue development without missing context.


## 1. Project Overview

### Purpose
AssetLife is a cross-platform asset lifecycle management system designed for individual users. It enables users to track, manage, and receive reminders for their assets (such as electronics, appliances, vehicles, etc.), covering warranty, insurance, and service events. The platform automates asset detection via Gmail integration, supports document uploads, and provides a modern web and mobile interface.

### Core Features Implemented
- Individual registration and OTP-based login
- Admin/user role model with admin CRUD endpoints
- Asset CRUD with lifecycle metadata and status computation
- Automated reminders for asset lifecycle events
- Gmail OAuth integration and mailbox sync for asset suggestion extraction
- Email scan pipeline for invoice detection and asset suggestion creation
- Suggestion parse/confirm/reject workflow
- Invoice and document file storage with secure streaming endpoints
- Excel template download and upload with validation/preview
- Category/subcategory/status master data APIs
- React web application with protected routes, dashboard, asset workflows, reminders, and profile/settings
- Flutter mobile app (Phase 1: authentication, dashboard, asset/reminder list)

### Tech Stack

**Backend:**
- Python 3.x, FastAPI (ASGI)
- Motor (async MongoDB driver)
- Pydantic / pydantic-settings
- python-jose (JWT)
- passlib[bcrypt] (password hashing)
- cryptography (Fernet encryption)
- httpx (HTTP client)
- openpyxl (Excel processing)
- PyPDF2, Pillow, pytesseract (PDF/OCR parsing)

**Frontend:**
- React 18, TypeScript
- react-router-dom v6
- Material-UI (MUI) + Emotion
- Zustand (state management)
- Axios (API client)
- Recharts (charts)
- PrimeFlex/PrimeIcons/PrimeReact (partial)

**Database:**
- MongoDB (`assetlife` database)

**Integrations:**
- Gmail OAuth2 + Gmail API (readonly)
- Local file storage for invoices/documents

**Mobile:**
- Flutter 3.x (Android, iOS planned)


## 2. Project Structure

### Top-Level Folders
- `backend/`: FastAPI backend, MongoDB integration, business logic, file processing
- `webapp/`: React TypeScript frontend
- `mobile/`: Flutter mobile app (currently Phase 1, partial)
- `PROJECT_RULES.md`: legacy rules snapshot
- `TECHNICAL_SUMMARY.md`: canonical technical reference (this file)

### Backend Structure
- `app/main.py`: FastAPI app bootstrap, CORS, router registration, startup/shutdown
- `app/core/`: config, JWT/security, crypto, exception framework, status master, logging
- `app/db/`: Mongo manager, index bootstrapping
- `app/models/`: role enum, user DB model
- `app/routes/`: all API route modules
- `app/services/`: OTP, user, Gmail, email scan, invoice parser, suggestion service
- `app/schemas/`: request/response contracts
- `uploads/`: stored invoices and documents

### Webapp Structure
- `src/index.tsx`: app entry
- `src/App.tsx`: route tree and theme wrapper
- `src/components/`: layout, private route, OTP input, modal components
- `src/pages/`: main pages
- `src/services/`: API client/service wrappers
- `src/store/`: Zustand auth/user store
- `src/utils/`: status/lifecycle helpers
- `src/features/`: legacy components (not active)
- `src/AppRoutes.tsx`: legacy router (not active)

### Mobile Structure
- `lib/`: core, features, shared (see section 8.1)
- `android/`, `ios/`, `macos/`, `linux/`, `windows/`: platform scaffolding

## 3. Backend Architecture

### Framework and Runtime
- FastAPI (ASGI) in `main.py`
- Uvicorn server
- Startup: MongoDB connect, index ensure, status master seed
- Shutdown: Mongo disconnect
- Health endpoint: `GET /health`

### Main Modules and Services
- Core: config, JWT, security, crypto, exceptions, status master
- DB: Mongo manager, index creation
- Services: user, OTP, Gmail, email scan, asset suggestion, invoice parser
- Routes: auth, individual, user, assets, asset suggestions, email scans, Gmail integration, categories, statuses, reminders, testing

### Middleware and Authentication
- CORS: `allow_origins=["http://localhost:3000"]`, credentials true
- Auth: HTTP Bearer JWT, claims: `sub`, `role`
- Authorization: route-level role dependencies, ownership checks

### Error Handling
- Custom exceptions mapped to JSON
- 500 fallback for unhandled errors
- Route-specific HTTPException for details

## 4. API Endpoints

See detailed section in file for each route: path, method, purpose, payload, response, auth, business rules, validation.

## 5. Database Design

See detailed section in file for each collection/table: name, purpose, fields, types, required/optional, defaults, indexes, relationships, business/validation rules.

## 6. Data Flow

- Frontend → Backend → Database: UI triggers service, API call, backend validates/processes, MongoDB read/write, response normalized in frontend
- Asset create/update/retrieve: duplicate checks, lifecycle enrichment, status compute, reminders, suggestion confirm, file/document handling
- No background jobs; Gmail sync and parsing run inline

## 7. Frontend Architecture

- React + TypeScript SPA
- MUI + Emotion for UI/theming
- Zustand for state
- Axios for API
- Route protection via PrivateRoute
- Responsive design, glass-morphism, card layouts
- Key pages: login, register, dashboard, assets, asset view, add asset, suggestions, email integrations, email scans, reminders, profile, settings, reports, users, legal
- State: token/user/theme in Zustand/localStorage
- API: centralized Axios, error handling, blob support
- Forms: local state, client/server validation, OTP cooldown
- Navigation: App.tsx, root redirects, protected routes

## 8. Application Navigation

- Login/authentication: mobile, OTP, token, redirect
- Registration: form, OTP, auto-login
- Dashboard: metrics, assets, reminders, suggestions
- Asset creation: multiple modes (email, excel, invoice, manual)
- Asset listing/editing: search/filter, CRUD, docs
- Settings/admin: profile, preferences, test data reset, users/reports (placeholders)

## 8.1 Mobile Application Architecture (Flutter Android)

- Flutter 3.x, Provider, Dio, Go Router, flutter_secure_storage
- Core: API client, constants, routing, theme, utils
- Features: auth, dashboard, assets, reminders
- Shared: models, services, widgets
- Theme: Material 3, light/dark, responsive
- API: base URL, auth, error handling
- State: Provider pattern
- Routing: Go Router, auth redirect
- Pages: login, OTP, dashboard, assets, reminders
- Secure token management
- Error handling: ApiException, SnackBar, 401 auto-logout
- Dependency injection: services/providers
- Phase 1: auth, dashboard, asset/reminder list (no add flows yet)
- Phase 2: add/edit asset/reminder, detail, docs, category UI, offline, push notifications

## 9. Business Logic

- Asset creation: category/subcategory required, duplicate prevention, source normalization
- Category/subcategory: master data, dedupe, validation
- Document handling: invoices/docs in uploads, file streaming, deletion
- Reminders: manual CRUD, auto from lifecycle, sync on update
- Notifications: not yet implemented
- Validation: OTP, Excel, status, etc.

## 10. External Integrations

- Gmail OAuth2, Gmail API (readonly)
- Email parsing, attachment scoring, invoice parsing
- File storage: local filesystem
- Third-party: FX rate API for invoice parser

## 11. Environment Configuration

- Backend: all env vars in config.py (see section), Gmail/Google vars, local uploads, debug/dev differences
- Frontend: REACT_APP_API_BASE_URL
- Dev vs prod: OTP debug, local Mongo/uploads, test reset endpoint

## 12. Security Implementation

- Auth: JWT bearer, claims, 401 handling
- Authorization: role-based, ownership
- Data protection: Fernet encryption, bcrypt, mobile hash
- API: input validation, ObjectId parsing, exception handling
- Gaps: OTP in-memory, debug exposure, localStorage token, CORS, test endpoint

## 13. Current Limitations / TODOs

- Placeholder pages (users, reports), mobile partial, legacy code
- No background jobs, notification dispatcher, cloud storage
- Endpoint contract inconsistencies, mixed env var names
- Temporary test reset endpoint/UI
- TODO/legacy code signals in repo

## 14. Development Notes

- Design: backend status source of truth, lifecycle field tolerance, suggestion pipeline, master data, reminder type auto-compute
- Workflow: attachment handling, logging best practices, build/artifact management, API response variations
- Caution: assets.py complexity, Gmail/token logic, profile branching, encryption helpers
- Assumptions: single backend, local uploads, Mongo normalization, Gmail callback domain
- Next steps: remove test endpoint, unify env vars, add background jobs, notification layer, prune legacy, add contract tests

## 2. Project Structure

### Top-Level
- `backend/`: FastAPI service, Mongo integration, business logic, file processing.
- `webapp/`: React TypeScript frontend.
- `mobile/`: Flutter placeholders (empty key files).
- `PROJECT_RULES.md`: older snapshot, partially outdated.
- `TECHNICAL_SUMMARY.md`: canonical technical reference.

### Backend Structure
- `backend/app/main.py`: app bootstrap, CORS, router registration, startup/shutdown.
- `backend/app/core/`: config, jwt/security, crypto, exception framework, status master, logging.
- `backend/app/db/`: Mongo manager and index bootstrapping.
- `backend/app/models/`: role enum and user DB model.
- `backend/app/routes/`: all active API route modules.
- `backend/app/services/`: OTP, user, Gmail, email scan, invoice parser, suggestion service.
- `backend/app/schemas/`: request/response contracts for auth/user/Gmail/suggestions.
- `backend/uploads/`: stored invoices and supporting documents.

### Webapp Structure
- `webapp/src/index.tsx`: app entry.
- `webapp/src/App.tsx`: active route tree and theme wrapper.
- `webapp/src/components/`: layout, private route, OTP input, modal components.
- `webapp/src/pages/`: active pages.
- `webapp/src/services/`: API client and service wrappers.
- `webapp/src/store/`: Zustand auth/user store.
- `webapp/src/utils/`: status/lifecycle utility helpers.
- `webapp/src/features/`: legacy components (not active runtime path).
- `webapp/src/AppRoutes.tsx`: legacy router (explicitly marked legacy).

### Mobile Structure
- `mobile/pubspec.yaml`: empty.
- `mobile/lib/main.dart`: empty.
- `mobile/lib/app.dart`: empty.
- `mobile/lib/features/...`: empty placeholders.

## 3. Backend Architecture

## 3. Backend Architecture

### Framework and Runtime
- FastAPI application in `main.py` (async ASGI framework).
- Uvicorn ASGI server (configured via `python-dotenv` and `app/core/config.py`).
- Startup hooks:
  - Connect to MongoDB
  - ensure indexes
  - ensure default status master rows
- Shutdown:
  - disconnect Mongo
- Health endpoint: `GET /health`.

### Module Responsibilities

Core:
- `config.py`: environment-backed settings.
- `jwt.py`: create/verify access tokens.
- `security.py`: HTTP Bearer auth + role checks.
- `crypto.py`: Fernet encryption/decryption + SHA-256 helpers.
- `exceptions.py`: custom API exception classes and JSON error handlers.
- `status_master.py`: seed and validate status values.

DB layer:
- `mongo.py`: singleton Mongo manager and `get_db()` dependency.
- `indexes.py`: collection index creation + duplicate cleanup logic.

Services:
- `user_service.py`: user CRUD/auth; field encryption; uniqueness checks.
- `otp_service.py`: in-memory OTP generation/verify + rate limiting.
- `gmail_service.py`: Gmail OAuth state, token exchange/refresh, Gmail API calls.
- `email_scan_service.py`: mailbox scanning, attachment scoring/parsing, suggestion creation.
- `asset_suggestion_service.py`: dedupe checks and suggestion persistence.
- `invoice_parser.py`: attachment text extraction + field parsing + currency conversion.

Routes:
- `auth.py`, `individual.py`, `user.py`
- `assets.py`, `asset_suggestions.py`
- `email_scans.py`, `gmail_integration.py`
- `categories.py`, `statuses.py`, `reminders.py`
- `testing.py` (temporary destructive endpoint)

### Middleware and Authentication
- CORS middleware configured in app (`allow_origins=["http://localhost:3000"]`, credentials true, all methods/headers).
- Authentication:
  - HTTP Bearer token
  - JWT payload requires `sub` and `role`
- Authorization:
  - route-level role dependencies via `require_roles(...)`
  - ownership checks for user-scoped resources in route handlers

### Error Handling Strategy
- Domain exceptions (`BadRequestError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`) mapped to structured JSON.
- Unhandled exceptions mapped to 500 with `INTERNAL_SERVER_ERROR` code.
- Some routes also raise raw `HTTPException` with route-specific details.

## 4. API Endpoints

All backend routes are currently mounted in `main.py`.

### Auth Routes (`/auth`)

#### POST `/auth/login/admin`
- Purpose: Admin/SuperAdmin login.
- Request payload:
  - `username: string`
  - `password: string`
- Response:
  - `access_token`
  - `token_type` (`bearer`)
  - `expires_in`
  - `user` (UserResponse)
- Auth required: No.
- Business rules:
  - user must exist in `users` with admin role.
  - password checked via bcrypt.
- Validation:
  - schema-based via `AdminLoginRequest`.

#### POST `/auth/login/individual`
- Purpose: legacy individual login (static OTP flow through users collection).
- Request payload:
  - `mobile`
  - `otp`
- Response:
  - token envelope (same as admin login)
- Auth required: No.
- Business rules:
  - compares OTP to `settings.OTP_STATIC_CODE`.
  - looks for `role=Individual` in `users` collection.
- Validation:
  - schema-based via `IndividualLoginRequest`.

#### POST `/auth/send-otp`
- Purpose: Send OTP for existing individual user (hash lookup).
- Request payload:
  - `mobile` (digits only, length 10-15)
- Response:
  - `{ "message": "OTP sent successfully" }`
- Auth required: No.
- Business rules:
  - user must exist in `individual_users` by `mobile_hash`.
  - rate limit: max 5 requests / 5 minutes.
  - OTP generated and printed in server logs/console.
- Validation:
  - field validator strips spaces and enforces numeric.

#### POST `/auth/verify-otp`
- Purpose: Verify OTP and issue JWT.
- Request payload:
  - `mobile`
  - `otp`
- Response:
  - success message + `access_token`
- Auth required: No.
- Business rules:
  - OTP status handling: not_found/expired/invalid/valid.
  - marks `individual_users.is_verified=true`.
- Validation:
  - numeric mobile, OTP length constraints.

### Individual Routes (`/individual`)

#### POST `/individual/register`
- Purpose: Register individual account.
- Request payload:
  - `name` (2-120)
  - `mobile` (digits)
  - `email` (optional, validated if present)
  - `dob`
  - `pan`
- Response:
  - message + `user_id`
  - includes `debug_otp` when `DEBUG=true`
- Auth required: No.
- Business rules:
  - prevents duplicate by `mobile_hash`.
  - stores encrypted fields (`encrypted_name/mobile/email/dob/pan`).
  - creates OTP immediately.

#### POST `/individual/send-otp`
- Purpose: Send OTP for login/verification.
- Request payload: `mobile`
- Response:
  - message (+ `debug_otp` in debug mode)
- Auth required: No.
- Business rules:
  - user existence check in `individual_users`.
  - rate limiting via OTP service.

#### POST `/individual/verify-otp`
- Purpose: Verify OTP and issue JWT.
- Request payload: `mobile`, `otp`.
- Response:
  - success message + `access_token`
- Auth required: No.
- Business rules:
  - marks user verified.
  - role claim in token is `individual`.

#### GET `/individual/profile`
- Purpose: Read current individual profile.
- Request payload: none.
- Response:
  - profile fields (`id`, `name`, `email`, `phone`, `organization`, `role`)
- Auth required: Yes.
- Business rules:
  - token subject converted to ObjectId.
  - decrypts encrypted fields before response.

#### PUT `/individual/update`
- Purpose: Update individual profile fields.
- Request payload:
  - query parameter: `user_id`
  - body supports only `name` and `email`
- Response:
  - updated profile fields.
- Auth required: Yes.
- Business rules:
  - strict allowed field set.
  - rejects unknown fields.
  - encrypts updated fields.
- Validation:
  - name length 2-120
  - email regex check

### User Routes (`/users`)

#### POST `/users`
- Purpose: Create user.
- Request payload: `UserCreate` schema.
- Response: `UserResponse`.
- Auth required: Yes (Admin/SuperAdmin).
- Business rules:
  - admin/superadmin roles require username+password.
  - uniqueness checks on username/mobile hash.
  - personal fields encrypted.

#### GET `/users`
- Purpose: List users.
- Query params: `skip`, `limit`.
- Response: list of `UserResponse`.
- Auth required: Yes (Admin/SuperAdmin).

#### GET `/users/{user_id}`
- Purpose: Fetch one user.
- Auth required: Yes.
- Authorization:
  - admin roles or self.

#### PUT `/users/{user_id}`
- Purpose: Update user.
- Payload: `UserUpdate`.
- Auth required: Yes.
- Authorization:
  - admin roles or self.

#### DELETE `/users/{user_id}`
- Purpose: Delete user.
- Auth required: Yes (Admin/SuperAdmin dependency in current code).

### Assets Routes (`/api/assets`)

#### GET `/api/assets`
- Purpose: list current user assets.
- Auth required: Yes.

#### POST `/api/assets`
- Purpose: create asset.
- Auth required: Yes.
- Request payload (body dict, major fields):
  - `name` or `product_name`
  - `category`, `subcategory` (required)
  - optional core fields (`brand`, `vendor`, `purchase_date`, `price`, etc.)
  - lifecycle fields under `lifecycle_info` or route-supported shape
  - source metadata (`source`, `suggestion_id`, email references)
- Response: created asset object.
- Business rules:
  - duplicate detection by invoice number / source email id / name+vendor+purchase_date.
  - auto status compute from lifecycle + inactive flag.
  - optional suggestion record marked confirmed.
  - auto reminder creation from lifecycle.
- Validation:
  - category/subcategory required and non-empty.

#### GET `/api/assets/{asset_id}`
- Purpose: fetch one asset.
- Auth required: Yes.
- Validation: ObjectId check + ownership.

#### PUT `/api/assets/{asset_id}`
- Purpose: update asset.
- Auth required: Yes.
- Business rules:
  - allowed field whitelist.
  - explicit statuses `Inactive|Lost|Damaged` preserved as user-controlled.
  - lifecycle statuses recomputed.
  - reminder sync when lifecycle changes.

#### DELETE `/api/assets/{asset_id}`
- Purpose: delete asset and related docs/reminders.
- Auth required: Yes.
- Business rules:
  - removes file binaries for documents.
  - removes asset_documents and reminders for asset.

#### GET `/api/assets/{asset_id}/invoice`
- Purpose: stream stored invoice file.
- Auth required: Yes.
- Validation: ownership + path existence.

#### POST `/api/assets/{asset_id}/documents`
- Purpose: upload supporting docs.
- Payload: multipart `files[]`.
- Response: uploaded doc metadata list.
- Auth required: Yes.

#### GET `/api/assets/{asset_id}/documents`
- Purpose: list supporting documents.
- Auth required: Yes.

#### GET `/api/assets/{asset_id}/documents/{document_id}/file`
- Purpose: stream document binary.
- Auth required: Yes.

#### DELETE `/api/assets/{asset_id}/documents/{document_id}`
- Purpose: delete document file and DB row.
- Auth required: Yes.

#### GET `/api/assets/excel/template`
- Purpose: generate and download Excel template.
- Auth required: Yes.
- Business rules:
  - builds master hidden sheet for categories/subcategories.
  - applies field validation lists/date/number validations.

#### POST `/api/assets/excel/upload`
- Purpose: parse uploaded template and return validated suggestion rows.
- Payload: multipart `file` (.xlsx only).
- Response:
  - row-level validation summary
  - valid/invalid counts
  - normalized `suggestions` list
- Auth required: Yes.
- Business rules:
  - template header alias matching
  - category/subcategory validation
  - duplicate detection against existing assets
  - lifecycle normalization from row fields

### Asset Suggestions Routes (`/api/assets/suggestions`)

#### GET `/api/assets/suggestions`
- Purpose: list suggestions for user.
- Auth required: Yes.
- Response model: `SuggestionResponse[]`.

#### POST `/api/assets/suggestions/clear-temp`
- Purpose: clear temporary non-final suggestions.
- Auth required: Yes.

#### POST `/api/assets/suggestions/{suggestion_id}/parse`
- Purpose: parse attachment and update extracted fields.
- Auth required: Yes.
- Business rules:
  - if no attachment, returns parsed status with guidance message.
  - uses `InvoiceParserService.parse_attachment`.

#### POST `/api/assets/suggestions/{suggestion_id}/reject`
- Purpose: mark suggestion rejected.
- Auth required: Yes.

#### POST `/api/assets/suggestions/{suggestion_id}/confirm`
- Purpose: confirm suggestion and create asset.
- Auth required: Yes.
- Business rules:
  - builds asset from suggestion+payload.
  - computes status from lifecycle.
  - marks suggestion confirmed + `already_added=true`.

#### GET `/api/assets/suggestions/{suggestion_id}/email`
- Purpose: fetch original Gmail message details.
- Auth required: Yes.
- Business rules:
  - retrieves Gmail message by `email_message_id`.
  - returns subject, sender, received date, extracted body, attachment metadata.

#### GET `/api/assets/suggestions/{suggestion_id}/attachment`
- Purpose: stream suggestion attachment.
- Query: `download` boolean for content disposition.
- Auth required: Yes.

### Email Scan Routes

#### GET `/api/emails`
- Purpose: list scan records.
- Auth required: Yes.

#### POST `/api/email/scan`
- Purpose: run Gmail sync and suggestion generation.
- Auth required: Yes.
- Request model: `GmailSyncRequest` (`days`, `max_results`, filters).
- Response model: `GmailSyncResponse`.
- Business rules:
  - requires Gmail OAuth env config.
  - validates mailbox status and configured email.
  - performs scan + parse + dedupe pipeline.
  - logs and returns validation errors for malformed suggestions.

### Gmail Integration Routes (`/api/integrations/gmail`)

#### GET `/status`
- Purpose: connection status.
- Auth required: Yes.

#### POST `/connect`
- Purpose: start OAuth flow and return auth URL/state.
- Auth required: Yes.

#### POST `/callback`
- Purpose: complete OAuth callback in API style.
- Auth required: Yes.

#### GET `/callback`
- Purpose: browser redirect callback and frontend redirect.
- Auth required: No (state token identifies user integration row).

#### POST `/disconnect`
- Purpose: disconnect Gmail and clear tokens.
- Auth required: Yes.

### Categories Routes (`/api/categories`)

#### GET `/api/categories`
- Purpose: list category + subcategory master.
- Auth required: Yes.

#### POST `/api/categories`
- Purpose: create category if not present.
- Auth required: Yes.

#### GET `/api/categories/{category_id}/subcategories`
- Purpose: list subcategories by category.
- Auth required: Yes.

#### POST `/api/categories/{category_id}/subcategories`
- Purpose: create subcategory if not present.
- Auth required: Yes.

### Reminders Routes (`/api/reminders`)

#### GET `/api/reminders`
- Purpose: list reminders.
- Auth required: Yes.
- Response fields include `type` (either `"asset"` or `"custom"`).

#### POST `/api/reminders`
- Purpose: create reminder.
- Auth required: Yes.
- Required fields: `title`, `reminder_date`.
- Optional fields: `asset_id`, `asset_name`, `reminder_type`, `status`, `notes`.
- Response: includes `type` field computed from presence of `asset_id`.
- Business rules:
  - `type` is automatically computed: `"asset"` if `asset_id` provided, `"custom"` otherwise
  - `asset_id` is normalized (whitespace trimmed, empty values become null)
  - `asset_name` is only stored if `asset_id` is present

#### PUT `/api/reminders/{reminder_id}`
- Purpose: update reminder fields.
- Auth required: Yes.
- Allowed fields: `title`, `asset_id`, `asset_name`, `reminder_date`, `reminder_type`, `status`, `notes`.
- Business rules:
  - `type` field is recomputed on update based on new `asset_id`
  - if `asset_id` is cleared, `asset_name` is also cleared
  - 404 if reminder not found or doesn't belong to current user

#### DELETE `/api/reminders/{reminder_id}`
- Purpose: delete reminder.
- Auth required: Yes.

### Statuses Route (`/api/statuses`)

#### GET `/api/statuses`
- Purpose: list active status master values.
- Auth required: Yes.

### Testing Route (`/api/testing`)

#### POST `/api/testing/reset-user-data`
- Purpose: destructive reset of current user test data.
- Auth required: Yes.
- Business rules:
  - deletes user assets/suggestions/reminders/docs and referenced files.
- Note: explicitly marked temporary and should be removed before production.

## 5. Database Design

Mongo database: `assetlife` (default via settings).

### `users`
Purpose:
- Stores admin/superadmin (and potentially individual role in legacy path).

Key fields:
- `_id: ObjectId`
- `role: RoleName`
- `username: string?`
- `password_hash: string?`
- encrypted personal fields: `name`, `mobile`, `dob`, `pan`
- `mobile_hash: string`
- `is_active: bool`
- `created_at`, `updated_at`

Business rules:
- uniqueness by username and mobile hash (service enforced).
- admin/superadmin require username/password.

### `individual_users`
Purpose:
- OTP-based end-user profile store.

Key fields:
- `_id`
- `encrypted_name`
- `encrypted_mobile`
- `encrypted_email` (optional)
- `encrypted_dob`
- `encrypted_pan`
- `mobile_hash`
- `is_verified`
- timestamps

Indexes:
- unique `mobile_hash`

### `assets`
Purpose:
- Main asset inventory records.

Key fields:
- ownership: `user_id`
- identity: `name`, `name_normalized`
- classification: `category`, `subcategory`
- metadata: `brand`, `vendor`, `vendor_normalized`, serial/model/invoice fields
- lifecycle: `warranty`, `insurance`, `service`
- status: `status`, `is_inactive`
- source tracking: `source`, `source_email_id`, sender/subject, suggestion refs
- file refs: `invoice_attachment_path`
- reminders: `auto_reminders_created`
- timestamps

Indexes:
- `user_id`, `category`, `subcategory`

Business rules:
- duplicate detection via invoice number / source email id / name+vendor+date.
- lifecycle-based status recomputation in create/update paths.

### `asset_suggestions`
Purpose:
- Candidate assets extracted from mailbox scan.

Key fields:
- `user_id`
- extracted asset fields (`product_name`, `vendor`, `price`, etc.)
- email fields (`sender`, `subject`, `email_date`, `email_message_id`)
- attachment metadata + stored file path
- `status` (`pending`, `rejected`, `confirmed`, etc.)
- `already_added`, optional `asset_id`
- timestamps

Indexes:
- compound `(user_id, status)`
- `email_message_id`

Business rules:
- minimum signal required before insertion (name/price/invoice_number).
- dedupe checks against assets before creating actionable suggestion.

### `email_scans`
Purpose:
- Scan history rows.

Key fields:
- `user_id`
- `gmail_message_id`
- sender/subject/date/status fields
- counters/metadata

Indexes:
- unique `(user_id, gmail_message_id)`

### `gmail_integrations`
Purpose:
- Gmail OAuth integration state per user.

Key fields:
- `user_id`
- `provider` (`gmail`)
- `connected`
- tokens (`access_token`, `refresh_token`)
- `token_expiry`
- `oauth_state`, `pending_email`, `email_address`
- `last_sync_at`, timestamps

Indexes:
- unique `(user_id, provider)` (created in scan service)

### `reminders`
Purpose:
- user-created and auto-generated reminders.

Key fields:
- `user_id`
- `asset_id` (optional; nullable; normalized to clean string or null)
- `asset_name` (optional; only present if asset_id is set)
- `title`
- `type` (reminder scope: `"asset"` or `"custom"` - automatically resolved from asset_id presence)
- `reminder_date`
- `reminder_type` (`"warranty"`, `"service"`, `"custom"`)
- `status` (`"active"`, `"completed"`, `"snoozed"`)
- `notes` (optional)
- timestamps

Business rules:
- `type="asset"` when `asset_id` is present and non-empty
- `type="custom"` when `asset_id` is null/empty
- asset_id is normalized (whitespace trimmed, empty strings converted to null)
- asset_name automatically cleared if asset_id is cleared
- on update, type is recomputed based on new asset_id value

Indexes:
- compound `(user_id, reminder_date)`

### `categories`
Purpose:
- category master.

Key fields:
- `name`, `category` (canonical string)
- `description`, `is_active`
- timestamps

Indexes:
- unique `category`

### `subcategories`
Purpose:
- subcategory master linked by category id string.

Key fields:
- `name`
- `category_id` (string ObjectId reference)
- metadata fields

Indexes:
- unique compound `(category_id, name)`

### `status_master`
Purpose:
- allowed status values.

Default seeded values:
- Active
- In Warranty
- Expired
- Expiring Soon
- Inactive
- Lost
- Damaged

Indexes:
- unique `name`

### `asset_documents`
Purpose:
- supporting document metadata for assets.

Key fields:
- `asset_id`, `user_id`
- `file_name`, `document_type`, `file_path`
- `uploaded_at`

Relationships summary:
- assets.user_id -> individual user id claim string
- reminders.asset_id -> assets._id string
- subcategories.category_id -> categories._id string
- suggestions.asset_id -> assets._id string (when confirmed)
- documents.asset_id -> assets._id string

## 6. Data Flow

### Frontend -> Backend -> Database
1. UI triggers service function in `webapp/src/services/*`.
2. Axios instance injects bearer token.
3. FastAPI route validates auth and payload.
4. Route delegates to service or executes business logic.
5. Motor writes/reads Mongo.
6. Response normalized in frontend services/pages.

### Asset Create/Update/Retrieve Flow

Create:
- Sources: manual entry, email suggestion confirm, Excel upload workflow, invoice upload path.
- Backend checks duplicates.
- Lifecycle parsed and enriched.
- Status computed.
- Asset inserted.
- Auto reminders generated.
- Optional suggestion record marked confirmed.

Update:
- Existing asset fetched.
- allowed fields merged.
- explicit non-lifecycle statuses preserved (`Inactive`, `Lost`, `Damaged`).
- otherwise lifecycle-based status recomputed.
- reminder sync deletes old relevant reminders and creates updated ones.

Retrieve:
- user-scoped list/single fetch.
- frontend parses lifecycle JSON/object variants safely.

### Background / Processing Logic
- No detached worker/queue system currently.
- Gmail sync + attachment parsing run inline during API call.
- OCR/PDF parsing and FX lookup happen in request path.

## 7. Frontend Architecture

### Framework
- React + TypeScript SPA.
- Route protection via `PrivateRoute` and Zustand token state.

### UI Framework and Styling Approach
- Material-UI (MUI v7) for component library and theming.
- Emotion for CSS-in-JS styling.
- PrimeFlex, PrimeIcons, PrimeReact for additional UI components (partial integration).
- Recharts for dashboard charts and data visualization.
- Global theme system with light/dark mode support via MUI ThemeProvider.
- Responsive design with CSS media queries for mobile/tablet/desktop breakpoints (480px, 768px, 1024px).
- Glass-morphism effect support (backdrop blur) with fallback for browsers without support.
- Managed font scaling (16px base on desktop, responsive down to 13px on mobile).
- Card-based layouts with smooth animations (fadeInUp).

### Component Structure
- `AdminLayout.tsx`: main app shell for authenticated routes (includes header with theme toggle, navigation, sidebar).
- `AuthLayout.tsx`: layout for public routes (login, register, legal pages).
- `PrivateRoute.tsx`: route guard enforcing authentication and token validation.
- `components/modules/`: feature-specific component groupings.
- Modal components for asset management, suggestion review, document upload.
- OTP input component with masking and validation.

### Key Pages
- `IndividualLogin` (`/login`): OTP send/verify flow for individual user authentication.
- `IndividualRegister` (`/register`): User registration form + OTP-based verification for new users.
- `Dashboard` (`/dashboard`): Metrics dashboard with asset counts by status, reminder windows, suggestion count.
- `Assets` (`/assets`): Searchable/filterable asset list/grid view with CRUD operations.
- `AssetView` (`/assets/:assetId`): Detailed view of a single asset including supporting documents and lifecycle data.
- `AddAsset` (`/assets/add`): Multi-mode asset onboarding (email sync, invoice upload, excel bulk upload, manual QR/entry).
- `AssetSuggestions` (`/assets/suggestions`): Review and confirm/reject parsed email suggestions with attachment viewing.
- `EmailIntegrations` (`/integrations/email`): Gmail OAuth connect/disconnect and settings management.
- `EmailScans` (`/emails`): Gmail sync history and suggestion actions.
- `Reminders` (`/reminders`): CRUD management for both custom reminders and asset-linked lifecycle reminders.
- `Profile` (`/profile`): User profile view/update with role-aware endpoint behavior.
- `Settings` (`/settings`): User preferences including theme selection and temporary test data reset action.
- `Reports` (`/reports`): Currently placeholder stub page.
- `Users` (`/users`): Currently placeholder stub page (intended for admin user management).
- **Legal Pages** (under `/legal/`, accessible from auth layout):
  - `PrivacyPolicy` (`/privacy-policy`)
  - `Terms` (`/terms`)
  - `Disclaimer` (`/disclaimer`)
  - `CookiePolicy` (`/cookies`)
  - `About` (`/about`)
  - `Contact` (`/contact`)
  - `Help` (`/help`)

### State Management
- Zustand store (`useUserStore`) for auth token, user profile, and theme preference.
- Token keys supported:
  - `access_token` (current standard)
  - `jwt_token` (legacy migration support)
- Token persisted in localStorage.
- Theme preference: `light` or `dark`; stored both in Zustand and synced to backend via `/individual/update?user_id={id}` endpoint (persisted in user profile).
- Theme toggle available in app header (AdminLayout) on protected routes.

### API Integration Approach
- Centralized Axios instance: `services/api.ts`
  - Base URL from environment variable `REACT_APP_API_BASE_URL` (default `http://192.168.0.14:8000`)
  - Default content-type: `application/json`
  - Request interceptor: injects `Authorization: Bearer <token>` header from Zustand store; falls back to `access_token` or `jwt_token` from localStorage
  - Response interceptor: auto-redirects to `/login` and logs out on 401 Unauthorized
  - Blob endpoints (document/invoice downloads) handled via `api.get(..., { responseType: "blob" })`
  - Error responses logged before throwing

### Form Handling and Validation
- Form state management: mostly local to pages/components (useState).
- Client-side validations:
  - Email regex pattern validation
  - Mobile number format (digits only, length constraints)
  - OTP input length and type constraints
  - Required field checks
  - Category/subcategory dropdown dependency
- Server-side validation:
  - Pydantic schemas enforce request contract
  - Backend validates business rules (e.g., duplicate asset detection, lifecycle date ranges)
  - 400 Bad Request for validation failures with detail messages
- OTP flow includes UI cooldown timer to prevent rapid resends.

### Navigation/Routing
- Active routes defined in `App.tsx`.
- Root redirects to `/dashboard`.
- login/register public; core screens protected.

## 8.1 Mobile Application Architecture (Flutter Android)

### Overview
AssetLife Mobile is a Flutter-based Android application providing asset lifecycle management on mobile devices. Built with Phase 1 focus on authentication, dashboard, assets, and reminders.

### Technology Stack
- **Framework**: Flutter 3.x with Dart
- **State Management**: Provider pattern
- **HTTP Client**: Dio with interceptors
- **Routing**: Go Router for navigation
- **Secure Storage**: flutter_secure_storage for token persistence
- **Date/Time**: intl package for formatting

### Project Structure
```
lib/
├── core/
│   ├── api/               # Dio API client with auth interceptors
│   ├── constants/         # App-wide constants (URLs, keys, routes)
│   ├── routing/           # Go Router configuration & route definitions
│   ├── theme/             # Light/Dark theme configuration
│   └── utils/             # Utilities (TBD)
├── features/
│   ├── auth/
│   │   ├── providers/     # AuthProvider (login state management)
│   │   └── screens/       # LoginScreen, OtpScreen
│   ├── dashboard/
│   │   └── screens/       # DashboardScreen (metrics & quick actions)
│   ├── assets/
│   │   ├── providers/     # AssetProvider (list, CRUD state)
│   │   └── screens/       # AssetsScreen (asset list & filtering)
│   └── reminders/
│       ├── providers/     # ReminderProvider (reminder state)
│       └── screens/       # RemindersScreen (reminder list & management)
├── shared/
│   ├── models/            # Data models (User, Asset, Reminder)
│   ├── services/          # API service wrappers (AuthService, AssetService, ReminderService)
│   └── widgets/           # Reusable UI components (AppCard, AppTextField, PrimaryButton, StatusBadge, EmptyState)
└── main.dart              # App entry point with Provider setup

android/
├── app/                   # Android app module
└── gradle/                # Build configuration
```

### Theme & UI
- **Material Design 3**: Leverages latest Material Design principles
- **Light & Dark Themes**: Full theme support with:
  - Primary color: Indigo (#6366F1)
  - Secondary color: Purple (#8B5CF6)
  - Accent color: Orange (#F97316)
  - Status colors: Green (success), Red (error), Blue (info), Orange (warning)
- **Responsive Design**: Breakpoints & flexible layouts for various device sizes
- **Reusable Widgets**:
  - `AppCard`: Card with optional tap handler
  - `AppTextField`: Input field with validation
  - `PrimaryButton`: Primary CTA button with loading state
  - `StatusBadge`: Color-coded status display
  - `EmptyState`: Placeholder for empty lists

### API Integration
- **Base URL**: `http://192.168.0.14:8000` (configurable via `AppConstants`)
- **Auth Flow**:
  1. Request interceptor injects `Authorization: Bearer <token>` from secure storage
  2. Response interceptor handles 401 → logout + redirect to login
  3. Tokens stored securely via `flutter_secure_storage`
- **Error Handling**: Custom `ApiException` with detailed error messages

### State Management
- **Provider Pattern**: ChangeNotifierProvider for reactive updates
- **Auth Provider**: Manages login, OTP verification, profile, logout
- **Asset Provider**: Manages asset list, CRUD, filtering
- **Reminder Provider**: Manages reminder list, CRUD, mark complete
- **Providers Injected**: Via `MultiProvider` in main.dart startup

### Routing Configuration (Go Router)
- **Routes**:
  - `/login`: Login screen (public)
  - `/otp`: OTP verification (public, with mobile extra parameter)
  - `/dashboard`: Dashboard (private)
  - `/assets`: Asset list (private)
  - `/reminders`: Reminder list (private)
- **Auth Redirect**: Automatically redirects unauthenticated users to `/login`
- **Authenticated Check**: Verifies token existence on app startup

### Pages & Screens

#### LoginScreen (`/login`)
- Mobile number input with validation
- Send OTP button with loading state
- Navigates to OTP screen on success

#### OtpScreen (`/otp`)
- OTP input (6-digit)
- Resend timer (5-minute countdown)
- Verify OTP button
- Back navigation to login

#### DashboardScreen (`/dashboard`)
- Metrics cards: Total Assets, Active Assets, Reminders, Status
- Quick action buttons: Assets & Reminders navigation
- Pull-to-refresh functionality

#### AssetsScreen (`/assets`)
- Asset list with card-based layout
- Status-based filtering chips (All, Active, In Warranty)
- Display: Name, Category, Status, Vendor, Price
- FAB for adding new assets (Phase 2)
- Pull-to-refresh, empty state handling

#### RemindersScreen (`/reminders`)
- Active reminders list
- Display: Title, Asset Name, Date, Type (Warranty/Service/Custom)
- Reminder type badges (color-coded)
- Mark as completed via checkbox
- Swipe-to-delete with confirmation
- FAB for creating reminders (Phase 2)
- Pull-to-refresh, empty state handling

### Secure Token Management
- **Storage**: `flutter_secure_storage` (platform-specific)
- **Key**: `access_token` in secure storage
- **Lifecycle**:
  - Stored after successful OTP verification
  - Retrieved on app startup to check auth status
  - Injected in all API requests via interceptor
  - Cleared on logout

### Error Handling
- **API Layer**: `ApiException` with message + status code
- **UI Layer**: SnackBar notifications for user feedback
- **401 Handling**: Auto-logout + redirect to login (configured in interceptor)

### Dependency Injection
- **Services**: Instantiated in main.dart and provided to entire app
- **Providers**: Created with service dependencies
- **Lifecycle**: Global & persistent throughout app lifetime

### Phase 1 Completion Status
✅ Project initialization with Flutter & Android support
✅ Clean architecture with separation of concerns
✅ Theme system (light/dark) matching web app
✅ API client with auth interceptors & secure token storage
✅ Routing with protected screens
✅ Auth flow: Login → OTP → Dashboard
✅ Dashboard with metrics
✅ Assets list with filtering
✅ Reminders list with status management
✅ Reusable UI components library
✅ State management with Provider pattern
⚠️ Ready for emulator testing

### Phase 2 Planned Features
- Add/Edit Asset screens
- Add/Edit Reminder screens
- Asset detail view with document management
- Category/Subcategory selection UI
- Lifecycle date picker & validation
- Email sync & suggestions on mobile
- Offline sync capabilities
- Push notifications for reminders
- Dark mode preference persistence

### Development Notes
- **Testing**: Run `flutter test` or use physical/emulator via Android Studio
- **Build**: `flutter build apk` for release APK
- **Hot Reload**: `flutter run` during development
- **Code Generation**: Some Future enhancements may require `build_runner`
- **Analyzer**: `flutter analyze` to check code quality (info-level warnings acceptable)
- **Dependencies**: Managed via `pubspec.yaml`; update with `flutter pub upgrade`

### Known Limitations (Phase 1)
- No email sync or suggestion preview on mobile yet
- No document upload/management screens yet
- No category master selector UI (phase 2)
- No offline capabilities yet
- Metrics are read-only (no add flows in Phase 1 screens)
- Theme preference not persisted across sessions yet

## 8. Application Navigation (User Flow)

### Login / Authentication
1. User opens `/login`.
2. Enters mobile number.
3. `POST /individual/send-otp`.
4. Enters OTP.
5. `POST /individual/verify-otp` returns token.
6. Token stored in Zustand + localStorage.
7. Redirect to `/dashboard`.

### Registration
1. `/register` form with name + email/phone.
2. Current implementation requires phone for OTP flow.
3. `POST /individual/register`, then OTP verify via `/individual/verify-otp`.
4. Auto-login and redirect to dashboard.

### Main Dashboard
- Shows asset counts by status, reminder windows, and suggestion count.
- Loads assets/reminders/suggestions concurrently.

### Asset Creation
Primary entry path: `/assets/add`.
Modes:
- Email sync mode: connect mailbox, sync, parse suggestions, confirm.
- Excel upload mode: download template, upload file, validate rows, create selected assets.
- Invoice upload/manual/QR modes: UI paths routed to modal/manual creation flows.

### Asset Listing and Editing
- `/assets` provides searchable/filterable list/grid.
- Edit/update via modal and update endpoint.
- view details via `/assets/:assetId`.
- upload/list/delete supporting docs.

### Settings and Admin/Management
- `/profile`: user profile management.
- `/settings`: includes temporary test data reset control.
- `/users` and `/reports`: currently placeholder pages in frontend.

## 9. Business Logic

### Asset Creation Rules
- Category and subcategory required.
- Duplicate prevention:
  - same invoice number (case-insensitive)
  - same source email id
  - same normalized name + vendor + purchase date
- Source normalization maps aliases (`gmail`, `manual_entry`, etc.) to canonical source.

### Category/Subcategory Logic
- Final category map defined in backend (`FINAL_CATEGORY_SUBCATEGORIES`).
- Non-Other categories force inclusion of subcategory `Other`.
- Category APIs dedupe case-insensitively.
- Excel template enforces category/subcategory validation lists.

### Document Handling
- Invoices stored in `uploads/invoices`.
- Supporting docs stored in `uploads/documents`.
- File paths persisted in DB; files streamed through authenticated endpoints.
- Deletion operations remove physical files and metadata rows.

### Reminder Logic
- Manual reminder CRUD via reminders API.
- Auto reminder creation from asset lifecycle at create/update.
- Lifecycle updates remove stale reminders and recreate according to new dates.

### Notification Logic
- No external notification channel integrated yet.
- Reminder records exist but no scheduler/dispatcher for SMS/email/push.

### Validation Rules
- OTP mobile validation (digits only, length checks).
- OTP TTL = 30s, rate limit 5 requests/5 min.
- Excel upload enforces template headers and row-level field constraints.
- Status values validated/mapped against status master list.

## 10. External Integrations

### Gmail Integration
- OAuth2 flow with Google endpoints.
- Scope: `https://www.googleapis.com/auth/gmail.readonly`.
- Supports connect, callback, token refresh, disconnect.
- Scan pipeline queries recent messages with attachments.

### Email Processing
- Parses Gmail message body and attachments.
- Attachment scoring to detect invoice likelihood.
- Parses up to top candidates; persists primary invoice attachment.

### File Storage
- Local filesystem storage under backend `uploads/`.
- No cloud object storage integration currently.

### Third-Party APIs
- Exchange rate lookup in invoice parser:
  - `https://open.er-api.com/v6/latest/{currency}`
  - fallback static FX map if needed.

## 11. Environment Configuration

### Backend Settings (from `core/config.py` + service code)
- `APP_NAME`
- `DEBUG`
- `ENCRYPTION_KEY`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `MONGODB_URI`
- `MONGODB_DB`
- `LOG_LEVEL`
- `LOG_FILE`
- `OTP_STATIC_CODE`
- `FRONTEND_APP_URL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `GMAIL_OAUTH_SCOPES`
- `GMAIL_ACCESS_TOKEN` (optional env-token mode)
- `GMAIL_REFRESH_TOKEN` (optional env-token mode)
- `GMAIL_EMAIL_ADDRESS` (optional env-token mode)

Additional env variable names referenced in Gmail/email scan services:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Note:
- There is mixed naming usage (`GMAIL_*` and `GOOGLE_*`) in different modules.

### Frontend Settings
- `REACT_APP_API_BASE_URL`

### Development vs Production Behavior
- In debug/dev, OTP may be printed and/or returned in response payload (`debug_otp`).
- OTP delivery is not integrated with SMS/email provider.
- Local upload directories and local MongoDB assumed.
- Testing reset endpoint is still accessible via UI.

## 12. Security Implementation

### Authentication
- JWT bearer tokens (HS256).
- Token claims include `sub`, `role`, optional username.
- 401 handling in frontend logs out and redirects.

### Authorization
- Role-based dependencies on protected admin endpoints.
- Per-user ownership checks for assets/suggestions/reminders/documents.

### Data Protection
- Sensitive individual and user personal fields encrypted with Fernet.
- mobile hash used for lookup and uniqueness.
- Admin passwords hashed with bcrypt.

### Protection Measures in API
- Input validation via Pydantic and manual guards.
- ObjectId parsing with 400 for invalid IDs.
- Structured exception handling.

### Security Gaps / Risk Notes
- OTP storage is in-memory only (no distributed/session-safe storage).
- OTP currently exposed in debug and terminal output in dev.
- Token persistence in localStorage (common SPA tradeoff, XSS-sensitive).
- CORS currently hardcoded for localhost frontend.
- Temporary destructive testing endpoint present in production code path.

## 13. Current Limitations / TODOs

### Partially Implemented / Placeholder Features
- Frontend `Users` and `Reports` pages are placeholders.
- Mobile module files are empty placeholders.
- Legacy frontend tree (`features/*`, `AppRoutes.tsx`) still in repo but inactive.

### Known Gaps
- No background job queue for heavy email/OCR processing.
- No notification dispatcher for reminders.
- No cloud file storage abstraction.
- Endpoint contracts are not fully uniform (some dict payloads, some strict schemas).
- Mixed environment variable names in Gmail modules.

### Explicit Temporary Features
- Backend: `/api/testing/reset-user-data` route is marked temporary.
- Frontend: Settings page exposes "Reset Test Data" action with temporary warning.

### TODO/Legacy/Outdated Code Signals
- `backend/app/routers/individual.py` re-exports route and is not active primary module.
- `backend/app/api/dependencies.py` empty.
- `backend/app/exceptions/custom_exceptions.py` empty.
- `webapp/src/features/*` marked legacy and not used by active router.

## 14. Development Notes

### Important Design Decisions
- Asset status source of truth moved to backend, not frontend-only computation.
- Lifecycle data supports multiple key naming patterns to tolerate heterogeneous payloads (e.g., `endDate` vs `end_date`).
- Suggestion pipeline designed for incremental/manual confirmation rather than auto-create.
- Category and status master data are centrally managed in backend collections.
- Reminder type field (`asset` vs `custom`) is automatically computed by backend based on presence of asset_id, ensuring consistent state.

### Development Workflow Notes

**Attachment and Invoice Handling:**
- Email Sync "Add Asset from suggestion" uses `POST /api/assets` with `suggestion_id` query parameter (not only `/api/assets/suggestions/{id}/confirm`)
- Attachment propagation fixes must cover BOTH:
  1. `/api/assets/suggestions/{suggestion_id}/confirm` endpoint
  2. Direct asset creation flow in `POST /api/assets` with `suggestion_id`
- Both paths must properly handle file attachment storage and path persistence

**Logging Best Practices:**
- Avoid using reserved LogRecord keys (e.g., `filename`, `levelname`) in logger `extra` dictionary
- Reserved keys can raise `KeyError` during email scan pipeline execution and silently prevent suggestion creation
- Use custom key names for application-specific metadata

**Build and Artifact Management:**
- Running `npm build` generates artifacts under `webapp/node_modules/.cache/babel-loader`
- Treat cache directories as generated artifacts; do not commit them
- Use `.gitignore` patterns to prevent accidental commits of build cache

**API Response Payload Variations:**
- Category/subcategory endpoints may return either `id` or `_id` from backend; frontend should accept both
- Asset lifecycle data can arrive as either JSON strings or objects; always parse safely with try-catch
- Warranty/Insurance/Service data support multiple field naming patterns:
  - Warranty: `warranty.available`, `warranty.end_date` or `warranty.endDate`
  - Insurance: `insurance.available`, `insurance.end_date`/`insurance.endDate`/`insurance.expiry_date`
  - Service: `service.available`/`service.required`, `service.next_service_date` or `service.nextServiceDate`

### Areas Requiring Caution Before Modification
- `assets.py`: large, high-complexity module handling template generation, lifecycle logic, reminders, and CRUD.
- Gmail/email scan services: token logic + parsing pipeline are tightly coupled.
- Profile flow: role-based branching uses different endpoints and payload shapes.
- Encryption helpers: changing key strategy without migration plan will break existing encrypted records.

### Assumptions in Current Implementation
- Single backend instance can safely manage OTP in memory (not true for distributed deployment).
- Upload filesystem is writable and persistent.
- MongoDB contains normalized data but frontend still defensively parses mixed field shapes.
- Gmail OAuth callback domain aligns with `FRONTEND_APP_URL` redirect expectations.

### Recommended Next Hardening Steps
1. Remove testing reset endpoint and UI trigger.
2. Unify Gmail env variable naming (`GMAIL_*` vs `GOOGLE_*`).
3. Add async background processing for email scan/attachment parse.
4. Implement notification dispatch layer for reminders.
5. Prune legacy frontend modules and stale backend wrappers.
6. Add contract tests/OpenAPI examples for all major endpoints.
