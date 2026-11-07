from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import dev_user_header_enabled
from app.database import get_db
from app.models import User
from app.security import TokenError, decode_access_token

# auto_error=False: a missing token must produce our 401 envelope, not FastAPI's 403.
bearer = HTTPBearer(auto_error=False, description="JWT access token from the login endpoint")


@dataclass
class CurrentUser:
    id: int
    role: str


def _unauthenticated(message: str) -> HTTPException:
    return HTTPException(
        401,
        detail={"code": "unauthenticated", "message": message},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _resolve_user(
    db: Session,
    credentials: Optional[HTTPAuthorizationCredentials],
    x_user_id: Optional[int],
) -> Optional[User]:
    """The calling user, ``None`` when the request carries no identity at all.

    Identity comes from ``Authorization: Bearer <jwt>``. The legacy ``X-User-Id`` header
    is only honoured when ALLOW_DEV_USER_HEADER=1 (local development before the login
    page is wired up); it is never accepted otherwise, because anyone can forge it.
    """
    if credentials is not None:
        try:
            email = decode_access_token(credentials.credentials)
        except TokenError:
            raise _unauthenticated("Invalid or expired token.")
        user = db.execute(select(User).where(func.lower(User.email) == email.lower())).scalar_one_or_none()
    elif x_user_id is not None and dev_user_header_enabled():
        user = db.get(User, x_user_id)
    else:
        return None
    if user is None or not user.is_active:
        raise _unauthenticated("Unknown or inactive user.")
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    x_user_id: Optional[int] = Header(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> CurrentUser:
    user = _resolve_user(db, credentials, x_user_id)
    if user is None:
        raise _unauthenticated("Authentication required.")
    return CurrentUser(id=user.id, role=user.role)


def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    x_user_id: Optional[int] = Header(default=None, include_in_schema=False),
    db: Session = Depends(get_db),
) -> Optional[int]:
    user = _resolve_user(db, credentials, x_user_id)
    return user.id if user else None


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """401 without a valid identity (from get_current_user), 403 for non-admins."""
    if user.role != "admin":
        raise HTTPException(403, detail={"code": "forbidden", "message": "Admin access required."})
    return user
