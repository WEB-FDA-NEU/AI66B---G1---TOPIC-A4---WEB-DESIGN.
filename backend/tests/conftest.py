"""Test fixtures. Tests run against a REAL PostgreSQL database because the code under test
relies on row locks, partial indexes and server-side time; SQLite cannot reproduce that.

Set TEST_DATABASE_URL to a throwaway database whose name contains "test". The suite
drops and recreates every table in it, so it refuses to run against anything else
(never point it at the shared team database).
"""
import os
from pathlib import Path

import pytest

TEST_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_URL:
    pytest.skip("TEST_DATABASE_URL is not set", allow_module_level=True)
if "test" not in TEST_URL.rsplit("/", 1)[-1].split("?")[0].lower():
    raise RuntimeError("TEST_DATABASE_URL must point at a database whose name contains 'test'.")

os.environ["DATABASE_URL"] = TEST_URL  # must happen before app.database is imported
os.environ["DISABLE_SWEEPER"] = "1"
os.environ["JWT_SECRET"] = "test-only-jwt-secret-not-used-anywhere-else"
# The booking tests identify callers with the development X-User-Id header.
os.environ["ALLOW_DEV_USER_HEADER"] = "1"

from datetime import datetime, timedelta, timezone  # noqa: E402

from sqlalchemy import text  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.models import Concert, Seat, User, Zone  # noqa: E402

SCHEMA = (Path(__file__).resolve().parents[1] / "schema.sql").read_text(encoding="utf-8")


@pytest.fixture(scope="session", autouse=True)
def _schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.exec_driver_sql(SCHEMA)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean():
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE tickets, orders, seats, reservations, zones, concerts, users "
                "RESTART IDENTITY CASCADE; ALTER SEQUENCE order_number_seq RESTART WITH 10483;"
            )
        )
    yield


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


def make_user(session, email, role="customer"):
    user = User(email=email, password_hash="x", full_name=email.split("@")[0], role=role)
    session.add(user)
    session.commit()
    return user.id


@pytest.fixture
def users(db):
    return {
        "a": make_user(db, "a@test.dev"),
        "b": make_user(db, "b@test.dev"),
        "c": make_user(db, "c@test.dev"),
        "staff": make_user(db, "staff@test.dev", role="staff"),
    }


@pytest.fixture
def concert(db):
    """One on-sale concert, 30 days out, with zone VIP (2 rows x 5 seats) and zone GA (1 x 5)."""
    now = datetime.now(timezone.utc)
    c = Concert(
        title="Test Tour",
        artist="Tester",
        venue="Arena",
        city="Hanoi",
        starts_at=now + timedelta(days=30),
        sale_start_at=now - timedelta(days=1),
        status="on_sale",
    )
    db.add(c)
    db.flush()
    vip = Zone(concert_id=c.id, name="VIP", price=1000, capacity=10)
    ga = Zone(concert_id=c.id, name="GA", price=300, capacity=5)
    db.add_all([vip, ga])
    db.flush()
    for zone, rows in ((vip, "AB"), (ga, "C")):
        for row in rows:
            for n in range(1, 6):
                db.add(Seat(zone_id=zone.id, row_label=row, seat_number=n))
    db.commit()
    return c.id


@pytest.fixture
def seat_ids(db, concert):
    """Seat ids ordered VIP A1..A5, B1..B5, GA C1..C5 -> index 0..14."""
    rows = db.execute(
        text("SELECT s.id FROM seats s JOIN zones z ON z.id = s.zone_id ORDER BY z.id, s.row_label, s.seat_number")
    ).scalars().all()
    return list(rows)


def expire_reservation(reservation_id):
    """Time-travel a hold into the past (keeps the expires_at > created_at check valid)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE reservations SET created_at = now() - interval '10 minutes', "
                "expires_at = now() - interval '1 minute' WHERE id = :id"
            ),
            {"id": reservation_id},
        )
        conn.execute(
            text("UPDATE seats SET held_until = now() - interval '1 minute' WHERE reservation_id = :id"),
            {"id": reservation_id},
        )


def scalar(sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar_one()


def bearer(session, user_id):
    """Authorization header with a real JWT for the given user."""
    from app.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(session.get(User, user_id).email)}"}
