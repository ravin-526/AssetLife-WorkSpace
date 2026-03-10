from dataclasses import dataclass

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.core.logger import app_logger


@dataclass
class ApiError(Exception):
    message: str
    status_code: int
    error_code: str


class BadRequestError(ApiError):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message=message, status_code=status.HTTP_400_BAD_REQUEST, error_code="BAD_REQUEST")


class AuthenticationError(ApiError):
    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message=message, status_code=status.HTTP_401_UNAUTHORIZED, error_code="AUTHENTICATION_ERROR")


class AuthorizationError(ApiError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message=message, status_code=status.HTTP_403_FORBIDDEN, error_code="AUTHORIZATION_ERROR")


class NotFoundError(ApiError):
    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message=message, status_code=status.HTTP_404_NOT_FOUND, error_code="NOT_FOUND")


class ConflictError(ApiError):
    def __init__(self, message: str = "Resource conflict") -> None:
        super().__init__(message=message, status_code=status.HTTP_409_CONFLICT, error_code="CONFLICT")


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.error_code,
                "message": exc.message,
            },
        },
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    app_logger.exception("Unhandled server error", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Internal server error",
            },
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
