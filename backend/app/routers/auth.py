"""Authentication against the PostgreSQL users table.

POST /api/auth/login accepts the OAuth2 form fields (username = email, password) so
Swagger's "Authorize" button works out of the box, and returns {access_token, token_type,
user} so the login page can store the token and route admins in a single round-trip.
POST /api/auth/register creates a new customer account with email uniqueness and password
complexity enforcement (#47).
"""
import re
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import User
from app.schemas import AuthUserOut, TokenOut
from app.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

# Checked when the e-mail is unknown so both failures take the same time.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt()).decode()


class RegisterInput(BaseModel):
    email: str = Field(max_length=255)
    full_name: str = Field(min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", "full_name", "phone", mode="before")
    @classmethod
    def _strip_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value.lower()

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        if not re.fullmatch(r"\+?[0-9 ()-]+", value) or not 8 <= len(re.sub(r"\D", "", value)) <= 15:
            raise ValueError("Phone numbers must contain 8–15 digits.")
        return value

    @field_validator("password")
    @classmethod
    def _validate_password_strength(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", value):
            raise ValueError("Password must contain at least one number.")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Password must contain at least one special character.")
        return value


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _password_matches(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
    }


@router.post("/register", response_model=AuthUserOut, status_code=201)
def register(body: RegisterInput, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    existing = db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            409,
            detail={"code": "email_taken", "message": "Email is already registered."},
        )
    user = User(
        email=email,
        password_hash=_hash_password(body.password),
        full_name=body.full_name.strip(),
        phone=body.phone,
        role="customer",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            detail={"code": "email_taken", "message": "Email is already registered."},
        )
    db.refresh(user)
    return _user_out(user)


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
