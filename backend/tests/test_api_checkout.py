"""HTTP layer for checkout (#42)."""
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


def hold(client, user, concert, ids):
    return client.post("/api/reservations", json={"concert_id": concert, "seat_ids": ids}, headers=h(user)).json()


def test_checkout_returns_paid_order_with_tickets(client, users, concert, seat_ids):
    reservation = hold(client, users["a"], concert, seat_ids[:2])
    r = client.post("/api/checkout", json={"reservation_id": reservation["id"], "payment_method": "card"}, headers=h(users["a"]))
    assert r.status_code == 201
    order = r.json()
    assert order["status"] == "paid" and order["total_amount"] == 2000 and len(order["tickets"]) == 2
    assert order["order_number"] >= 10483 and order["tickets"][0]["ticket_code"].startswith("CTL-")
    again = client.post("/api/checkout", json={"reservation_id": reservation["id"], "payment_method": "card"}, headers=h(users["a"]))
    assert again.json()["id"] == order["id"]  # idempotent


def test_checkout_errors(client, users, concert, seat_ids):
    reservation = hold(client, users["a"], concert, seat_ids[:1])
    body = {"reservation_id": reservation["id"], "payment_method": "card"}
    assert client.post("/api/checkout", json=body, headers=h(users["b"])).status_code == 404
    bad = client.post("/api/checkout", json={**body, "payment_method": "bitcoin"}, headers=h(users["a"]))
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "invalid_payment_method"
    expire_reservation(reservation["id"])
    gone = client.post("/api/checkout", json=body, headers=h(users["a"]))
    assert gone.status_code == 410 and gone.json()["error"]["code"] == "reservation_expired"
