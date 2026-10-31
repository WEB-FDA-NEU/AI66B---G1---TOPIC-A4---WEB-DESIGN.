from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


@dataclass
class CurrentUser:
    id: int
    role: str


def get_current_user(
    x_user_id: Optional[int] = Header(default=None),
    db: Session = Depends(get_db),
) -> CurrentUser:
    """Identify the caller.

    TEMPORARY: there is no login API yet, so the caller is taken from the ``X-User-Id``
    header. This is a development stub and is NOT secure (anyone can claim any id).
    When real authentication lands, replace only this function (e.g. decode a JWT);
    every route and service already receives the user through this dependency.
    """
    if x_user_id is None:
        raise HTTPException(401, detail={"code": "unauthenticated", "message": "Missing X-User-Id header."})
    user = db.get(User, x_user_id)
    if user is None or not user.is_active:
        raise HTTPException(401, detail={"code": "unauthenticated", "message": "Unknown or inactive user."})
    return CurrentUser(id=user.id, role=user.role)


def get_optional_user_id(x_user_id: Optional[int] = Header(default=None)) -> Optional[int]:
    return x_user_id
