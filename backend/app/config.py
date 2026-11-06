import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

# Base directory for backend
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / ".env")


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "Concertly API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Security & Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "default-dev-secret-key-change-in-production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/concertly",
    )

    # CORS
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ]

    # Business Rules
    RESERVATION_TTL: timedelta = timedelta(
        seconds=int(os.getenv("RESERVATION_TTL_SECONDS", "300"))
    )
    MAX_SEATS_PER_RESERVATION: int = int(os.getenv("MAX_SEATS_PER_RESERVATION", "8"))
    CANCEL_CUTOFF: timedelta = timedelta(hours=24)
    PAYMENT_METHODS: tuple[str, ...] = ("card", "ewallet", "bank_transfer")
    EXPIRY_SWEEP_INTERVAL: int = int(os.getenv("EXPIRY_SWEEP_INTERVAL", "30"))
    MAX_TX_RETRIES: int = int(os.getenv("MAX_TX_RETRIES", "3"))


settings = Settings()
