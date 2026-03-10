# AssetLife Workspace — Current Project Summary

## Project Name
AssetLife

## Purpose of the Application
AssetLife is an asset lifecycle management platform workspace with:
- A Python FastAPI backend (`backend`) exposing authentication, individual-user, and user-management APIs.
- A React + TypeScript web frontend (`webapp`) for individual registration/login and dashboard access.
- A Flutter mobile module scaffold (`mobile`) present in the workspace (currently minimal/incomplete).

## Technology Stack

### Backend (`backend`)
- Language: Python
- Framework: FastAPI
- ASGI server: Uvicorn
- Database driver: Motor (MongoDB async client)
- Security/auth libraries:
	- `python-jose` for JWT
	- `passlib[bcrypt]` for password hashing
	- `cryptography` for field encryption
- Config management: `pydantic-settings`
- Logging: `loguru`

Dependencies source: `backend/requirements.txt`

### Frontend (`webapp`)
- Framework: React 18
- Language: TypeScript
- Routing: `react-router-dom`
- HTTP client: Axios
- State management: Zustand
- Build tooling: Create React App (`react-scripts`)

Dependencies source: `webapp/package.json`

### Mobile (`mobile`)
- Flutter/Dart structure exists (`mobile/lib`), but `mobile/pubspec.yaml` is currently empty.

## Backend Architecture

### Entry Point
- `backend/app/main.py`
	- Creates FastAPI app
	- Registers CORS middleware (`allow_origins=["*"]`)
	- Registers exception handlers
	- Includes routers:
		- `app.routes.auth`
		- `app.routes.individual`
		- `app.routes.user`
	- Connects/disconnects MongoDB on startup/shutdown

### Major Backend Layers
- `app/core`
	- `config.py`: settings and environment mapping
	- `jwt.py`: JWT creation/verification
	- `security.py`: bearer token parsing and role-based dependency checks
	- `crypto.py`: encryption/decryption and SHA-256 helper
	- `exceptions.py`: typed API exceptions + global handlers
- `app/db`
	- `mongo.py`: `MongoManager` and database dependency (`get_db`)
- `app/routes`
	- `auth.py`: admin login, individual login, OTP send/verify endpoints under `/auth`
	- `individual.py`: registration/profile/update + OTP send/verify under `/individual`
	- `user.py`: admin/superadmin-protected user CRUD
- `app/services`
	- `user_service.py`: business logic for user CRUD + admin/individual authentication
- `app/models`
	- role enum and DB model mapping helpers
- `app/schemas`
	- Pydantic request/response schemas

### API Surface (Current)
- Health: `GET /health`
- Auth:
	- `POST /auth/login/admin`
	- `POST /auth/login/individual`
	- `POST /auth/send-otp`
	- `POST /auth/verify-otp`
- Individual:
	- `POST /individual/register`
	- `POST /individual/send-otp`
	- `POST /individual/verify-otp`
	- `GET /individual/profile`
	- `PUT /individual/update`
- Users:
	- `POST /users`
	- `GET /users`
	- `GET /users/{user_id}`
	- `PUT /users/{user_id}`
	- `DELETE /users/{user_id}`

## Frontend Architecture

### Runtime Entry and Routing
- Entry: `webapp/src/index.tsx`
- Active app shell: `webapp/src/App.tsx`
	- Routes currently used:
		- `/login` → `pages/IndividualLogin.tsx`
		- `/register` → `pages/IndividualRegister.tsx`
		- `/dashboard` → `pages/Dashboard.tsx`
- Alternate route tree exists in `webapp/src/AppRoutes.tsx` using `features/*` and `components/PrivateRoute`, but `index.tsx` currently mounts `App.tsx`.

### Frontend Modules
- `src/pages`: current page-level UI for auth/dashboard flow
- `src/components`: shared components (includes `PrivateRoute.tsx`; `base` and `modules` folders are present)
- `src/services`: centralized HTTP client (`api.ts`)
- `src/api`: helper wrappers (`auth.ts`) + compatibility re-export (`axiosInstance.ts`)
- `src/store`: Zustand auth/user store (`jwt_token` persistence)
- `src/styles`: theme tokens and UI style primitives
- `src/features`: alternate/parallel feature-based components (auth/dashboard)

## Folder Structure (High-Level)

```text
assetlife-workspace
├── backend
│   ├── app
│   │   ├── core
│   │   ├── db
│   │   ├── models
│   │   ├── routes
│   │   ├── schemas
│   │   └── services
│   ├── requirements.txt
│   └── .env
├── webapp
│   ├── src
│   │   ├── api
│   │   ├── components
│   │   ├── features
│   │   ├── pages
│   │   ├── services
│   │   ├── store
│   │   └── styles
│   ├── package.json
│   └── .env
├── mobile
├── docs
└── scripts
```

## Authentication Flow

### Mechanisms Present
- OTP-based individual flow
- JWT access token issuance
- Role-based authorization for admin/superadmin routes

### OTP Flow (Backend)
Two OTP flows currently exist:

1. **`/individual/*` OTP flow** (`backend/app/routes/individual.py`)
	 - `POST /individual/send-otp`
		 - Validates user exists in `individual_users`
		 - Generates random 6-digit OTP
		 - Stores OTP in in-memory `_otp_store` with TTL
		 - Prints OTP in backend terminal for development testing
	 - `POST /individual/verify-otp`
		 - Validates OTP from `_otp_store`
		 - Marks user verified
		 - Returns JWT token

2. **`/auth/*` OTP flow** (`backend/app/routes/auth.py`)
	 - `POST /auth/send-otp` and `POST /auth/verify-otp` also implemented with in-memory store and random OTP print.

### JWT Flow
- Token creation: `app/core/jwt.py` (`create_access_token`)
- Token verification: `app/core/security.py` (`get_current_user`)
- Frontend stores token in Zustand + localStorage key `jwt_token`.

### Additional Auth Detail
- `UserService.authenticate_individual()` in `backend/app/services/user_service.py` still validates against `settings.OTP_STATIC_CODE` for `/auth/login/individual` path, which differs from the new in-memory OTP verify endpoints.

## API Communication Flow

### Frontend → Backend
- Centralized Axios client: `webapp/src/services/api.ts`
	- `baseURL` from `REACT_APP_API_BASE_URL` (fallback to `http://192.168.0.14:8000`)
	- JSON content-type default
	- Request interceptor adds `Authorization: Bearer <token>` from Zustand store
	- Response interceptor logs user out and redirects to `/login` on `401`

### Current Endpoint Usage in Active Pages
- `IndividualLogin.tsx`:
	- `POST /individual/send-otp`
	- `POST /individual/verify-otp`
- `IndividualRegister.tsx`:
	- `POST /individual/register`
	- `POST /individual/send-otp`
	- `POST /individual/verify-otp`

## Environment Configuration

### Frontend (`webapp/.env`)
- `REACT_APP_API_BASE_URL=http://192.168.0.14:8000`

### Backend (`backend/.env`)
- `APP_NAME=AssetLife`
- `DEBUG=True`
- `JWT_SECRET_KEY=...`
- `JWT_ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `ENCRYPTION_KEY=...`
- `MONGODB_URI=mongodb://localhost:27017`
- `DATABASE_NAME=assetlife`

### Config Note
- Backend settings file expects `MONGODB_DB` (not `DATABASE_NAME`) in `app/core/config.py`; if `MONGODB_DB` is absent, default `assetlife` is used.

## Current Development Status

- Web frontend compiles successfully (`npm run build` currently passes).
- Backend includes active OTP generation + terminal print in both `/individual` and `/auth` OTP endpoints.
- Duplicate/parallel frontend architecture exists (`pages/*` and `features/*`), with `App.tsx` currently the active route source.
- Mobile module is scaffolded but appears incomplete/placeholder in current workspace (empty `pubspec.yaml`).
- Workspace now contains `.git/`, but commit history/workflow status is outside this summary.

