from enum import Enum


class RoleName(str, Enum):
    SUPER_ADMIN = "SuperAdmin"
    ADMIN = "Admin"
    INDIVIDUAL = "Individual"
    CORPORATE_USER = "Corporate User"


ADMIN_ROLES: tuple[RoleName, ...] = (RoleName.SUPER_ADMIN, RoleName.ADMIN)
