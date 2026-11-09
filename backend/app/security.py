"""JWT access tokens (HS256, ``sub`` = user e-mail)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, jwt_secret


class TokenError(Exception):
    """The token is missing, malformed, expired or cannot be verified."""


def create_access_token(email: str, expires_in: timedelta | None = None) -> str:
    secret = jwt_secret()
    if not secret:
        raise RuntimeError("JWT_SECRET is not set.")
    expire = datetime.now(timezone.utc) + (expires_in or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return jwt.encode({"sub": email, "exp": expire}, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """Return the e-mail in a valid token or raise TokenError."""
    secret = jwt_secret()
    if not secret:
        raise TokenError("Token authentication is not configured.")
    try:
        payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise TokenError("Token has no subject.")
    return subject
