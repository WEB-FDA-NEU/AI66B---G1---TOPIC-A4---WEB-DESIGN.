"""HTTP layer for orders, tickets, cancellation and check-in (#43)."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import expire_reservation


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def h(user_id):
    return {"X-User-Id": str(user_id)}


def test_full_purchase_flow(client, users, concert, seat_ids):
    a = h(users["a"])
    r = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": seat_ids[:2]}, headers=a)
    assert r.status_code == 201
    hold = r.json()
    assert hold["status"] == "active" and hold["total_amount"] == 2000 and 0 < hold["seconds_left"] <= 300

    assert client.get(f"/api/reservations/{hold['id']}", headers=a).json()["seats"][0]["zone_name"] == "VIP"

    r = client.post("/api/checkout", json={"reservation_id": hold["id"], "payment_method": "card", "buyer": {"full_name": "Test Buyer", "email": "buyer@example.com", "phone": "0912345678"}}, headers=a)
    assert r.status_code == 201
    order = r.json()
    assert order["status"] == "paid" and len(order["tickets"]) == 2 and order["total_amount"] == 2000

    assert client.get("/api/orders", headers=a).json()[0]["id"] == order["id"]
    assert client.get(f"/api/orders/{order['id']}", headers=a).json()["can_cancel"] is True
    assert len(client.get("/api/tickets", headers=a).json()) == 2
    t = order["tickets"][0]
    assert client.get(f"/api/tickets/{t['id']}", headers=a).json()["ticket_code"] == t["ticket_code"]
    assert client.get(f"/api/orders/{order['id']}", headers=h(users["b"])).status_code == 404

    # staff scan
    assert client.post("/api/tickets/check-in", json={"ticket_code": t["ticket_code"]}, headers=a).status_code == 403
    ok = client.post("/api/tickets/check-in", json={"ticket_code": t["ticket_code"]}, headers=h(users["staff"]))
    assert ok.status_code == 200 and ok.json()["status"] == "used"
    again = client.post("/api/tickets/check-in", json={"ticket_code": t["ticket_code"]}, headers=h(users["staff"]))
    assert again.status_code == 409 and again.json()["error"]["code"] == "ticket_already_used"


def test_release_expired_checkout_and_cancel(client, users, concert, seat_ids):
    a = h(users["a"])
    hold = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": [seat_ids[0]]}, headers=a).json()
    assert client.delete(f"/api/reservations/{hold['id']}", headers=a).json()["status"] == "cancelled"

    hold = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": [seat_ids[0]]}, headers=a).json()
    expire_reservation(hold["id"])
    r = client.post("/api/checkout", json={"reservation_id": hold["id"], "payment_method": "card", "buyer": {"full_name": "Test Buyer", "email": "buyer@example.com", "phone": "0912345678"}}, headers=a)
    assert r.status_code == 410 and r.json()["error"]["code"] == "reservation_expired"

    hold = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": [seat_ids[0]]}, headers=a).json()
    order = client.post("/api/checkout", json={"reservation_id": hold["id"], "payment_method": "bank_transfer", "buyer": {"full_name": "Test Buyer", "email": "buyer@example.com", "phone": "0912345678"}}, headers=a).json()
    c = client.post(f"/api/orders/{order['id']}/cancel", json={"reason": "x"}, headers=a)
    assert c.status_code == 200 and c.json()["refund_status"] == "refunded"
    assert client.post(f"/api/orders/{order['id']}/cancel", headers=a).status_code == 409
    assert client.get("/api/orders?status=cancelled", headers=a).json()[0]["id"] == order["id"]
    assert client.get("/api/orders?status=bogus", headers=a).status_code == 422
