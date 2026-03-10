from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.constants import error_response
from app.core.logging import app_logger


async def global_exception_handler(request: Request, exc: Exception):
    app_logger.error(f"Unhandled error: {exc}")

    return JSONResponse(
        status_code=500,
        content=error_response(
            message="Internal Server Error",
            error_code="INTERNAL_ERROR",
        ),
    )