from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
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


@router.get("/status", response_model=GmailConnectionStatus)
async def gmail_status(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailConnectionStatus:
    service = GmailService(db)
    return await service.get_connection_status(current_user["id"])


@router.post("/connect", response_model=GmailConnectResponse)
async def gmail_connect(payload: GmailConnectRequest, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailConnectResponse:
    service = GmailService(db)
    return await service.start_connection(current_user["id"], payload.email)


@router.post("/callback", response_model=GmailConnectionStatus)
async def gmail_callback(payload: GmailCallbackRequest, current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> GmailConnectionStatus:
    service = GmailService(db)
    await service.complete_connection(current_user["id"], payload.code, payload.state)
    return await service.get_connection_status(current_user["id"])


@router.get("/callback")
async def gmail_callback_redirect(
    code: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
    db=Depends(get_db),
) -> RedirectResponse:
    service = GmailService(db)
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
