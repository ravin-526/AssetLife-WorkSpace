from fastapi import APIRouter, Depends, Query, status

from app.core.exceptions import AuthorizationError
from app.core.security import get_current_user, require_roles
from app.db.mongo import get_db
from app.models.role import RoleName
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN))],
)
async def create_user(payload: UserCreate, db=Depends(get_db)) -> UserResponse:
    return await UserService(db).create_user(payload)


@router.get(
    "",
    response_model=list[UserResponse],
    dependencies=[Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN))],
)
async def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db=Depends(get_db),
) -> list[UserResponse]:
    return await UserService(db).list_users(skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user=Depends(get_current_user), db=Depends(get_db)) -> UserResponse:
    if current_user["role"] not in {RoleName.SUPER_ADMIN.value, RoleName.ADMIN.value} and current_user["id"] != user_id:
        raise AuthorizationError("You can only access your own profile")
    return await UserService(db).get_user(user_id)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
) -> UserResponse:
    if current_user["role"] not in {RoleName.SUPER_ADMIN.value, RoleName.ADMIN.value} and current_user["id"] != user_id:
        raise AuthorizationError("You can only update your own profile")
    return await UserService(db).update_user(user_id, payload)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN))],
)
async def delete_user(user_id: str, db=Depends(get_db)) -> None:
    await UserService(db).delete_user(user_id)
