"""Minimal login against the PostgreSQL ``users`` table.

Same contract as the auth task (#47): ``POST /api/auth/login`` takes an OAuth2 password
form (``username`` = e-mail, ``password``) and returns ``{access_token, token_type}``
(plus the user, so the frontend can show the name and pick the right area). Tokens are
the JWTs that ``app.deps`` verifies. Registration / password changes belong to #47.
"""
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import User
from app.schemas import AuthUserOut, TokenOut
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

# Checked when the e-mail is unknown so both failures take the same time.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode()


def _password_matches(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:  # not a bcrypt hash (e.g. a placeholder): never matches
        return False


def _user_out(user: User) -> dict:
    return {"id": user.id, "email": user.email, "full_name": user.full_name, "phone": user.phone, "role": user.role}


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form.username.strip().lower()
    user = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    ok = _password_matches(form.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not ok:
        raise HTTPException(401, detail={"code": "invalid_credentials", "message": "Incorrect email or password."})
    if not user.is_active:
        raise HTTPException(403, detail={"code": "account_disabled", "message": "This account is disabled."})
    return {"access_token": create_access_token(user.email), "token_type": "bearer", "user": _user_out(user)}


@router.get("/me", response_model=AuthUserOut)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_out(db.get(User, current.id))
