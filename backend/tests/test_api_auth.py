"""Tests for user registration, password complexity, IntegrityError handling and login (#47)."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, get_db
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_register_and_login_flow(client, db):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "NewUser@Test.dev",
            "full_name": "New User",
            "phone": "0912345678",
            "password": "StrongPassword!1",
        },
    )
    assert reg.status_code == 201, reg.text
    user_out = reg.json()
    assert user_out["email"] == "newuser@test.dev"
    assert user_out["role"] == "customer"

    # Duplicate email returns 409 email_taken
    dup = client.post(
        "/api/auth/register",
        json={
            "email": "newuser@test.dev",
            "full_name": "Duplicate",
            "password": "StrongPassword!1",
        },
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "email_taken"

    # Login with registered email (case-insensitive)
    login_res = client.post(
        "/api/auth/login",
        data={"username": "NEWUSER@test.dev", "password": "StrongPassword!1"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "newuser@test.dev"


def test_register_handles_concurrent_integrity_error_as_409(client, db):
    def failing_db():
        session = SessionLocal()

        def raise_integrity():
            raise IntegrityError("INSERT INTO users ...", {}, Exception("uq_users_email_lower"))

        session.commit = raise_integrity
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = failing_db
    try:
        res = client.post(
            "/api/auth/register",
            json={"email": "race@test.dev", "full_name": "Race User", "password": "StrongPassword!1"},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "email_taken"


@pytest.mark.parametrize(
    "bad_password",
    [
        "Short!1",          # < 8 chars
        "alllowercase!1",   # missing uppercase
        "NoDigitsHere!",    # missing digit
        "NoSpecialChar1",   # missing special character
    ],
)
def test_register_enforces_password_complexity_422(client, db, bad_password):
    res = client.post(
        "/api/auth/register",
        json={
            "email": "weak@test.dev",
            "full_name": "Weak Pass",
            "password": bad_password,
        },
    )
    assert res.status_code == 422, bad_password
    body = res.json()
    assert body["error"]["code"] == "validation_error"
    assert any("password" in f["loc"] for f in body["error"]["fields"])


def test_multiple_users_with_same_phone_do_not_break_login(client, db):
    for idx in (1, 2):
        r = client.post(
            "/api/auth/register",
            json={
                "email": f"user{idx}@test.dev",
                "full_name": f"User {idx}",
                "phone": "0901234567",
                "password": "StrongPassword!1",
            },
        )
        assert r.status_code == 201

    # Logging in with email works cleanly and logging in with phone is not matched
    ok = client.post("/api/auth/login", data={"username": "user1@test.dev", "password": "StrongPassword!1"})
    assert ok.status_code == 200
    phone_login = client.post("/api/auth/login", data={"username": "0901234567", "password": "StrongPassword!1"})
    assert phone_login.status_code == 401
