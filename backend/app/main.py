from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logger import app_logger, configure_logging
from app.core.status_master import ensure_default_statuses
from app.db.indexes import ensure_indexes
from app.db.mongo import get_mongo_manager
from app.routes.asset_suggestions import router as asset_suggestions_router
from app.routes.assets import router as assets_router
from app.routes.auth import router as auth_router
from app.routes.categories import router as categories_router
from app.routes.email_scans import router as email_scans_router
from app.routes.gmail_integration import router as gmail_integration_router
from app.routes.individual import router as individual_router
from app.routes.reminders import router as reminders_router
from app.routes.statuses import router as statuses_router
from app.routes.testing import router as testing_router
from app.routes.user import router as user_router


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

configure_logging()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(individual_router)
app.include_router(user_router)
app.include_router(gmail_integration_router)
app.include_router(email_scans_router)
app.include_router(asset_suggestions_router)
app.include_router(assets_router)
app.include_router(statuses_router)
app.include_router(categories_router)
app.include_router(reminders_router)
app.include_router(testing_router)


@app.on_event("startup")
async def startup_event() -> None:
    manager = get_mongo_manager()
    await manager.connect()
    db = manager.get_database()
    await ensure_indexes(db)
    await ensure_default_statuses(db)
    app_logger.info("AssetLife API started")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await get_mongo_manager().disconnect()
    app_logger.info("AssetLife API stopped")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok"
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )