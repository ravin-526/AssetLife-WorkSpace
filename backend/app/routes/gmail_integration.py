from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.core.security import get_current_user
from app.db.mongo import get_db
from app.schemas.gmail_import import (
    GmailCallbackRequest,
    GmailConnectRequest,
    GmailConnectResponse,
    GmailConnectionStatus,
    GmailDisconnectResponse,
)
from app.services.gmail_service import GmailService

router = APIRouter(prefix="/api/integrations/gmail", tags=["Gmail Integration"])


def _mobile_oauth_html(status: str, message: str) -> HTMLResponse:
    escaped_message = (message or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    deep_link = f"assetlife://oauth-callback?status={status}"
    html = f"""
<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Asset Life OAuth</title>
        <style>
            body {{ font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }}
            .card {{ max-width: 520px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 18px; }}
            .btn {{ display: inline-block; margin-top: 12px; background: #17a2b8; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; }}
        </style>
        <script>
            window.setTimeout(function () {{
                window.location.href = \"{deep_link}\";
            }}, 250);
        </script>
    </head>
    <body>
        <div class=\"card\">
            <h2>Asset Life</h2>
            <p>{escaped_message}</p>
            <a class=\"btn\" href=\"{deep_link}\">Return to Asset Life App</a>
            <p style=\"margin-top: 10px; color: #555;\">If the app did not open automatically, tap the button above.</p>
        </div>
    </body>
</html>
"""
    return HTMLResponse(content=html, status_code=200)


@router.get("/status", response_model=GmailConnectionStatus)
async def gmail_status(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailConnectionStatus:
    service = GmailService(db)
    return await service.get_connection_status(current_user["id"])


@router.post("/connect", response_model=GmailConnectResponse)
async def gmail_connect(payload: GmailConnectRequest, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailConnectResponse:
    service = GmailService(db)
    print("CONNECT API SOURCE:", payload.source)
    response = await service.start_connection(current_user["id"], payload.email, payload.source)
    print("STATE SENT:", response.get("state"))
    return response


@router.post("/callback", response_model=GmailConnectionStatus)
async def gmail_callback(payload: GmailCallbackRequest, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailConnectionStatus:
    service = GmailService(db)
    await service.complete_connection(current_user["id"], payload.code, payload.state)
    return await service.get_connection_status(current_user["id"])


@router.get("/callback", response_model=None)
async def gmail_callback_redirect(
    code: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
    source: str | None = Query(default=None),
    db=Depends(get_db),
):
    service = GmailService(db)
    # Default to web for safety
    resolved_source = "web"
    try:
        await service.complete_connection_via_state(code, state)
        params = urlencode({"method": "email_sync", "status": "connected"})
        return RedirectResponse(url=f"{settings.FRONTEND_APP_URL}/assets/add?{params}", status_code=302)
    except HTTPException as error:
        params = urlencode({"method": "email_sync", "status": "error", "message": str(error.detail)})
        return RedirectResponse(url=f"{settings.FRONTEND_APP_URL}/assets/add?{params}", status_code=302)


@router.post("/disconnect", response_model=GmailDisconnectResponse)
async def gmail_disconnect(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailDisconnectResponse:
    service = GmailService(db)
    await service.disconnect(current_user["id"])
    return GmailDisconnectResponse(disconnected=True)
