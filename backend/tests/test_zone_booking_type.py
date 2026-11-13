"""Regression for PR #83: admission type belongs to zone ID, never its name."""
from pathlib import Path

import pytest
from psycopg2.errors import CheckViolation
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.services import reservations, checkout, orders
from tests.conftest import make_user, bearer
from tests.test_api_admin import concert_payload


@pytest.fixture
def client():
    with TestClient(app) as value:
        yield value


@pytest.mark.parametrize("mode", ["seated", "standing"])
def test_new_admin_zone_can_be_booked_and_renamed_without_changing_contract(client, db, users, mode):
    admin = make_user(db, "zone-admin@test.dev", "admin")
    headers = bearer(db, admin)
    # Arbitrary name/ID with no entry in the legacy JSON.
    payload = concert_payload(zones=[{"name": "Custom admission", "price": 100, "capacity": 4, "booking_type": mode}])
    response = client.post("/api/admin/concerts", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    concert = response.json()
    zone = concert["zones"][0]
    assert zone["booking_type"] == mode
    assert client.get(f"/api/concerts/{concert['id']}").json()["zones"][0]["booking_type"] == mode
    ids = list(db.execute(text("SELECT id FROM seats WHERE zone_id=:z ORDER BY id"), {"z": zone["id"]}).scalars())
    hold = reservations.hold_tickets(db, users["a"], concert["id"], ids[:1] if mode == "seated" else [], [(zone["id"], 1)] if mode == "standing" else [])
    order = checkout.checkout(db, users["a"], hold.id, "card")
    ticket = order["tickets"][0]
    # Old client omits booking_type on edit: must preserve DB type.
    payload["zones"] = [{"id": zone["id"], "name": "Renamed arbitrary zone", "price": 100, "capacity": 4}]
    response = client.put(f"/api/admin/concerts/{concert['id']}", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["zones"][0]["booking_type"] == mode
    result = orders.get_ticket(db, users["a"], ticket["id"])
    assert result["id"] == ticket["id"] and result["qr_data"] == ticket["ticket_code"]
    assert result["booking_type"] == mode
    assert (result["row"] is None) == (mode == "standing")
    assert list(db.execute(text("SELECT id FROM seats WHERE zone_id=:z ORDER BY id"), {"z": zone["id"]}).scalars()) == ids
    payload["zones"][0]["booking_type"] = "standing" if mode == "seated" else "seated"
    rejected = client.put(f"/api/admin/concerts/{concert['id']}", json=payload, headers=headers)
    assert rejected.status_code == 409 and rejected.json()["error"]["code"] == "booking_type_has_bookings"


def test_change_type_only_before_bookings_and_validate_enum(client, db, users):
    admin = make_user(db, "zone-admin@test.dev", "admin")
    headers = bearer(db, admin)
    payload = concert_payload()
    response = client.post("/api/admin/concerts", json=payload, headers=headers)
    assert response.status_code == 201
    concert = response.json(); zone = concert["zones"][0]
    assert zone["booking_type"] == "seated"
    payload["zones"][0].update(id=zone["id"], booking_type="standing")
    assert client.put(f"/api/admin/concerts/{concert['id']}", json=payload, headers=headers).status_code == 200
    hold = reservations.hold_tickets(db, users["a"], concert["id"], [], [(zone["id"], 1)])
    payload["zones"][0]["booking_type"] = "seated"
    assert client.put(f"/api/admin/concerts/{concert['id']}", json=payload, headers=headers).status_code == 409
    reservations.release_reservation(db, hold.id, users["a"])
    assert client.put(f"/api/admin/concerts/{concert['id']}", json=payload, headers=headers).status_code == 200
    payload["zones"][0]["booking_type"] = "invalid"
    assert client.put(f"/api/admin/concerts/{concert['id']}", json=payload, headers=headers).status_code == 422


def test_migration_preserves_ids_and_admin_choices_on_rerun(db):
    sql = (Path(__file__).resolve().parents[1] / "migrations/001_zone_booking_type.sql").read_text()
    # A temporary shadow table exercises the real migration against legacy structure.
    connection = db.bind.raw_connection()
    try:
        cur = connection.cursor()
        cur.execute("CREATE TEMP TABLE zones (id bigint PRIMARY KEY, concert_id bigint, name text)")
        cur.execute("INSERT INTO zones VALUES (1,1,'VIP Diamond Experience'), (2,1,'Standard Tier 1'), (3,999,'Unknown')")
        connection.commit()
        cur.execute(sql)
        cur.execute("SELECT id,booking_type FROM zones ORDER BY id")
        assert cur.fetchall() == [(1,'standing'), (2,'seated'), (3,'seated')]
        cur.execute("UPDATE zones SET name='Renamed',booking_type='standing' WHERE id=3")
        connection.commit()
        cur.execute(sql)
        cur.execute("SELECT booking_type FROM zones WHERE id=3")
        assert cur.fetchone()[0] == 'standing'
        with pytest.raises(CheckViolation):
            cur.execute("UPDATE zones SET booking_type='invalid' WHERE id=3")
        connection.rollback()
    finally:
        with connection.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS pg_temp.zones")
        connection.commit()
        connection.close()
