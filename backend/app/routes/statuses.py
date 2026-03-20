from typing import Any

from fastapi import APIRouter, Depends

from app.core.status_master import get_active_status_names
from app.core.security import get_current_user
from app.db.mongo import get_db

router = APIRouter(prefix="/api/statuses", tags=["Statuses"])


@router.get("")
async def list_statuses(current_user: dict[str, str] = Depends(get_current_user), db=Depends(get_db)) -> list[dict[str, Any]]:
    _ = current_user
    names = await get_active_status_names(db)
    return [{"name": name} for name in names]
