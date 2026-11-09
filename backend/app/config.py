import os
from datetime import timedelta

# A seat hold lasts 5 minutes (matches the countdown shown on the checkout page).
RESERVATION_TTL = timedelta(seconds=int(os.getenv("RESERVATION_TTL_SECONDS", "300")))
MAX_SEATS_PER_RESERVATION = 8
# Customers may cancel a paid order until this long before the concert starts.
CANCEL_CUTOFF = timedelta(hours=24)
PAYMENT_METHODS = ("card", "ewallet", "bank_transfer")
# How often the background sweeper releases expired holds (seconds).
EXPIRY_SWEEP_INTERVAL = 30
# Retries when PostgreSQL aborts a transaction because of a deadlock/serialization clash.
MAX_TX_RETRIES = 3

# Authentication. Tokens are HS256 JWTs whose "sub" is the user's e-mail (the same format
# the login endpoint of the auth task issues). JWT_SECRET must be set in the environment.
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def jwt_secret() -> str | None:
    return os.getenv("JWT_SECRET") or None


def dev_user_header_enabled() -> bool:
    """X-User-Id identification is a development stub; it is OFF unless explicitly enabled."""
    return os.getenv("ALLOW_DEV_USER_HEADER") == "1"
