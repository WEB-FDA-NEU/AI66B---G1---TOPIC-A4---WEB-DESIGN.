from __future__ import annotations

from dataclasses import dataclass
from typing import Generator, Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

security = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    username: str = "guest"
    role: str = "customer"  # 'customer', 'staff', 'admin'
    is_active: bool = True


def get_current_user(
    x_user_id: Optional[int] = Header(default=None, alias="X-User-Id"),
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    """Identify and authenticate the caller.

    Supports:
    1. Development stub via 'X-User-Id' header.
    2. Bearer token (JWT placeholder ready for production auth integration).
    """
    if x_user_id is not None:
        role = "admin" if x_user_id == 1 else "customer"
        return CurrentUser(id=x_user_id, username=f"user_{x_user_id}", role=role)

    if auth is not None and auth.credentials:
        # Placeholder for JWT verification
        return CurrentUser(id=1, username="authenticated_user", role="customer")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthenticated", "message": "Missing X-User-Id header or Bearer token."},
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_optional_user(
    x_user_id: Optional[int] = Header(default=None, alias="X-User-Id"),
) -> Optional[CurrentUser]:
    """Dependency for endpoints where authentication is optional."""
    if x_user_id is not None:
        return CurrentUser(id=x_user_id, username=f"user_{x_user_id}")
    return None


def require_role(required_role: str):
    """Dependency factory for role-based access control (RBAC)."""
    def role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "forbidden", "message": f"Requires '{required_role}' role permission."},
            )
        return current_user

    return role_checker


def get_db() -> Generator:
    """Database session dependency placeholder.

    Yields a database session if SQLAlchemy SessionLocal is configured,
    otherwise yields None.
    """
    try:
        from app.database import SessionLocal  # type: ignore
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    except (ImportError, ModuleNotFoundError):
        yield None
