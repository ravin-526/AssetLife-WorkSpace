from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logger import app_logger, configure_logging
from app.db.mongo import get_mongo_manager
from app.routes.auth import router as auth_router
from app.routes.individual import router as individual_router
from app.routes.user import router as user_router


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

configure_logging()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth_router)
app.include_router(individual_router)
app.include_router(user_router)


@app.on_event("startup")
async def startup_event() -> None:
    await get_mongo_manager().connect()
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