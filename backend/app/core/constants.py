from typing import Any


def success_response(data: Any = None, message: str = "Success"):
    return {
        "success": True,
        "message": message,
        "data": data,
    }


def error_response(message: str = "Error", error_code: str = "GENERIC_ERROR"):
    return {
        "success": False,
        "message": message,
        "error_code": error_code,
    }