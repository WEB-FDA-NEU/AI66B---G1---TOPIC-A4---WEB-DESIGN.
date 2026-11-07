"""Login and the account pages' API (#37): /auth, /orders/me, /tickets/me, ownership, QR."""
import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from tests.conftest import bearer, scalar
from tests.test_api_admin import add_order


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def set_password(db, user_id, password):
    db.execute(
        text("UPDATE users SET password_hash = :h WHERE id = :i"),
        {"h": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(), "i": user_id},
    )
    db.commit()


def login(client, email, password):
    return client.post("/api/auth/login", data={"username": email, "password": password})


@pytest.fixture
def bought(db, users, concert, seat_ids):
    """User a: paid order (2 VIP) + refunded order (1 GA). User b: paid order (1 GA)."""
    return {
        "a_paid": add_order(db, users["a"], concert, seat_ids[:2], "paid"),
        "a_refunded": add_order(db, users["a"], concert, seat_ids[10:11], "refunded"),
        "b_paid": add_order(db, users["b"], concert, seat_ids[11:12], "paid"),
    }


# -------------------------------------------------------------------------- login


def test_login_returns_a_working_token(client, db, users):
    set_password(db, users["a"], "correct horse")
    r = login(client, "A@Test.dev ", "correct horse")
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"] == {"id": users["a"], "email": "a@test.dev", "full_name": "a", "phone": None, "role": "customer"}
    h = {"Authorization": f"Bearer {body['access_token']}"}
    assert client.get("/api/auth/me", headers=h).json()["id"] == users["a"]
    assert client.get("/api/orders/me", headers=h).status_code == 200


@pytest.mark.parametrize("email,password", [("a@test.dev", "wrong"), ("nobody@test.dev", "correct horse")])
def test_login_rejects_bad_credentials(client, db, users, email, password):
    set_password(db, users["a"], "correct horse")
    r = login(client, email, password)
    assert r.status_code == 401
    assert r.json()["error"] == {"code": "invalid_credentials", "message": "Incorrect email or password."}


def test_login_with_placeholder_hash_never_succeeds(client, users):
    # conftest users have password_hash "x", which is not a bcrypt hash
    assert login(client, "a@test.dev", "x").status_code == 401


def test_login_disabled_account(client, db, users):
    set_password(db, users["a"], "correct horse")
    db.execute(text("UPDATE users SET is_active = false WHERE id = :i"), {"i": users["a"]})
    db.commit()
    assert login(client, "a@test.dev", "correct horse").status_code == 403


def test_login_requires_form_fields(client):
    assert client.post("/api/auth/login", data={"username": "a@test.dev"}).status_code == 422


def test_auth_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_seeded_accounts_can_log_in(client, db):
    from scripts import seed as seed_module

    seed_module.seed(
        db, seed_module.load_data(), env={"SEED_ADMIN_PASSWORD": "admin-pw-1", "SEED_USER_PASSWORD": "user-pw-1"},
        out=lambda *_: None,
    )
    db.commit()
    admin = login(client, "admin@concertly.dev", "admin-pw-1").json()
    assert admin["user"]["role"] == "admin"
    assert client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin['access_token']}"}).status_code == 200
    customer = login(client, "minhanh@concertly.dev", "user-pw-1").json()
    orders = client.get("/api/orders/me", headers={"Authorization": f"Bearer {customer['access_token']}"}).json()
    assert {o["order_number"] for o in orders} == {o["orderNumber"] for o in seed_module.load_data()["orders"]
                                                   if o["user"] == "minhanh@concertly.dev"}


# ------------------------------------------------------------- orders / tickets me


@pytest.mark.parametrize("path", ["/api/orders/me", "/api/tickets/me", "/api/orders/1", "/api/tickets/1",
                                  "/api/orders/1/cancel"])
def test_account_endpoints_require_token(client, path):
    r = client.post(path) if path.endswith("cancel") else client.get(path)
    assert r.status_code == 401


def test_orders_me_lists_only_own_orders(client, db, users, bought):
    a = client.get("/api/orders/me", headers=bearer(db, users["a"])).json()
    assert {o["id"] for o in a} == {bought["a_paid"], bought["a_refunded"]}
    assert client.get("/api/orders", headers=bearer(db, users["a"])).json() == a  # legacy path, same data
    first = next(o for o in a if o["id"] == bought["a_paid"])
    assert (first["artist"], first["venue"], first["city"], first["total_amount"], first["ticket_count"]) == (
        "Tester", "Arena", "Hanoi", 2000, 2)
    b = client.get("/api/orders/me", headers=bearer(db, users["b"])).json()
    assert [o["id"] for o in b] == [bought["b_paid"]]


def test_tickets_me_lists_only_own_tickets_with_codes(client, db, users, bought):
    tickets = client.get("/api/tickets/me", headers=bearer(db, users["a"])).json()
    assert len(tickets) == 3
    assert {t["order_id"] for t in tickets} == {bought["a_paid"], bought["a_refunded"]}
    for t in tickets:
        assert t["ticket_code"]
        # only tickets that still grant entry carry QR data
        assert t["qr_data"] == (t["ticket_code"] if t["status"] == "valid" else None)
    assert {t["status"] for t in tickets} == {"valid", "refunded"}


def test_order_detail_ownership(client, db, users, bought):
    r = client.get(f"/api/orders/{bought['a_paid']}", headers=bearer(db, users["a"]))
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "paid" and d["total_amount"] == 2000 and d["can_cancel"] is True
    assert [(t["zone"], t["price"], t["status"]) for t in d["tickets"]] == [("VIP", 1000, "valid")] * 2
    # someone else's order looks exactly like a missing one
    other = client.get(f"/api/orders/{bought['b_paid']}", headers=bearer(db, users["a"]))
    missing = client.get("/api/orders/999999", headers=bearer(db, users["a"]))
    assert other.status_code == missing.status_code == 404
    assert other.json() == missing.json()


def test_ticket_detail_has_qr_image_and_holder(client, db, users, bought):
    ticket_id = scalar("SELECT id FROM tickets WHERE order_id = :o ORDER BY id LIMIT 1", o=bought["a_paid"])
    r = client.get(f"/api/tickets/{ticket_id}", headers=bearer(db, users["a"]))
    assert r.status_code == 200
    t = r.json()
    assert t["holder_name"] == "a" and t["qr_data"] == t["ticket_code"]
    assert t["qr_image"].startswith("data:image/svg+xml")
    assert client.get(f"/api/tickets/{ticket_id}", headers=bearer(db, users["b"])).status_code == 404


def test_refunded_ticket_has_no_qr(client, db, users, bought):
    ticket_id = scalar("SELECT id FROM tickets WHERE order_id = :o", o=bought["a_refunded"])
    t = client.get(f"/api/tickets/{ticket_id}", headers=bearer(db, users["a"])).json()
    assert t["status"] == "refunded" and t["qr_data"] is None and t["qr_image"] is None


def test_cancel_updates_server_and_hides_qr(client, db, users, bought):
    h = bearer(db, users["a"])
    r = client.post(f"/api/orders/{bought['a_paid']}/cancel", json={"reason": "cannot attend"}, headers=h)
    assert r.status_code == 200
    d = r.json()
    assert (d["status"], d["payment_status"], d["refund_status"], d["refund_amount"]) == ("cancelled", "refunded", "refunded", 2000)
    assert d["can_cancel"] is False
    # persisted: a fresh request (reload / another device) sees the same state
    again = client.get(f"/api/orders/{bought['a_paid']}", headers=h).json()
    assert again["status"] == "cancelled" and all(t["status"] == "refunded" for t in again["tickets"])
    assert all(t["qr_data"] is None for t in client.get("/api/tickets/me", headers=h).json())
    assert client.post(f"/api/orders/{bought['a_paid']}/cancel", headers=h).json()["error"]["code"] == "already_cancelled"


def test_cannot_cancel_someone_elses_order(client, db, users, bought):
    r = client.post(f"/api/orders/{bought['b_paid']}/cancel", headers=bearer(db, users["a"]))
    assert r.status_code == 404
    assert scalar("SELECT status FROM orders WHERE id = :i", i=bought["b_paid"]) == "paid"
