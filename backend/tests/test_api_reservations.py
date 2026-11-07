"""HTTP layer: routing, auth stub, status codes, error envelope and JSON shapes."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import expire_reservation


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


ZERO = "00000000-0000-0000-0000-000000000000"


def h(user_id):
    return {"X-User-Id": str(user_id)}


def test_requires_identity(client, users):
    r = client.get(f"/api/reservations/{ZERO}")
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthenticated"
    assert client.get(f"/api/reservations/{ZERO}", headers=h(9999)).status_code == 401


def test_seat_map_shows_holds_and_marks_mine(client, users, concert, seat_ids):
    client.post("/api/reservations", json={"concert_id": concert, "seat_ids": [seat_ids[0]]}, headers=h(users["a"]))
    zones = client.get(f"/api/concerts/{concert}/seats", headers=h(users["a"])).json()["zones"]
    vip = {s["id"]: s for s in zones[0]["seats"]}
    assert vip[seat_ids[0]]["status"] == "held" and vip[seat_ids[0]]["held_by_me"] is True
    assert zones[0]["available"] == 9 and zones[0]["price"] == 1000
    other = client.get(f"/api/concerts/{concert}/seats", headers=h(users["b"])).json()["zones"][0]["seats"]
    assert [s for s in other if s["id"] == seat_ids[0]][0]["held_by_me"] is False
    assert client.get("/api/concerts/9999/seats").status_code == 404


def test_conflict_and_error_envelope(client, users, concert, seat_ids):
    body = {"concert_id": concert, "seat_ids": [seat_ids[0]]}
    assert client.post("/api/reservations", json=body, headers=h(users["a"])).status_code == 201
    r = client.post("/api/reservations", json=body, headers=h(users["b"]))
    assert r.status_code == 409
    assert r.json()["error"] == {"code": "seat_unavailable", "message": "Some seats are no longer available.", "seat_ids": [seat_ids[0]]}
    bad = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": []}, headers=h(users["a"]))
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "validation_error"


def test_hold_get_release_and_expiry(client, users, concert, seat_ids):
    a = h(users["a"])
    hold = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": seat_ids[:2]}, headers=a)
    assert hold.status_code == 201
    hold = hold.json()
    assert hold["status"] == "active" and hold["total_amount"] == 2000 and 0 < hold["seconds_left"] <= 300
    got = client.get(f"/api/reservations/{hold['id']}", headers=a).json()
    assert got["seats"][0]["zone_name"] == "VIP"
    assert client.get(f"/api/reservations/{hold['id']}", headers=h(users["b"])).status_code == 404
    assert client.delete(f"/api/reservations/{hold['id']}", headers=a).json()["status"] == "cancelled"

    again = client.post("/api/reservations", json={"concert_id": concert, "seat_ids": seat_ids[:1]}, headers=a).json()
    expire_reservation(again["id"])
    after = client.get(f"/api/reservations/{again['id']}", headers=a).json()
    assert after["status"] == "expired" and after["seconds_left"] == 0
