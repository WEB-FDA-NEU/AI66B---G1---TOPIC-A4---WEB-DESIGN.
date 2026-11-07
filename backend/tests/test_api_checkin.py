"""Admin attendee list and check-in API (#36)."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.services import checkin as checkin_svc
from tests.conftest import bearer, make_user, scalar
from tests.test_api_admin import add_concert, add_order
from tests.test_concurrency import failures, race, wins


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin(db):
    return make_user(db, "gate@test.dev", role="admin")


@pytest.fixture
def gate(db, users, concert, seat_ids):
    """Concert fixture with: a paid order of a (2 VIP tickets), a refunded order of b
    (1 GA ticket), a pending order of c (no tickets) and another concert's paid order."""
    other = add_concert(db, "Other Show", 20, "on_sale")
    db.execute(text("INSERT INTO zones (concert_id, name, price, capacity) VALUES (:c, 'GA', 100, 1)"), {"c": other})
    db.execute(
        text("INSERT INTO seats (zone_id, row_label, seat_number) SELECT id, 'Z', 1 FROM zones WHERE concert_id = :c"),
        {"c": other},
    )
    db.commit()
    other_seat = scalar("SELECT s.id FROM seats s JOIN zones z ON z.id = s.zone_id WHERE z.concert_id = :c", c=other)
    add_order(db, users["a"], concert, seat_ids[:2], "paid")
    add_order(db, users["b"], concert, seat_ids[10:11], "refunded")
    add_order(db, users["c"], concert, seat_ids[11:12], "pending")
    add_order(db, users["b"], other, [other_seat], "paid")

    def ticket(where, **params):
        return db.execute(text(f"SELECT id, ticket_code FROM tickets WHERE {where}"), params).first()

    return {
        "concert": concert,
        "other": other,
        "valid": [ticket("seat_id = :s", s=s) for s in seat_ids[:2]],
        "refunded": ticket("status = 'refunded'"),
        "foreign": ticket("concert_id = :c", c=other),
    }


def checkin(client, db, admin, concert_id, ticket_ref):
    return client.post("/api/admin/checkin", json={"ticketId": ticket_ref, "concertId": concert_id}, headers=bearer(db, admin))


# ------------------------------------------------------------------ access control


@pytest.mark.parametrize("method,path", [("get", "/api/admin/concerts/1/attendees"), ("post", "/api/admin/checkin")])
def test_requires_admin(client, db, users, method, path):
    body = {"json": {"ticketId": 1, "concertId": 1}} if method == "post" else {}
    assert getattr(client, method)(path, **body).status_code == 401
    for who in ("a", "staff"):
        r = getattr(client, method)(path, headers=bearer(db, users[who]), **body)
        assert r.status_code == 403, who


# ---------------------------------------------------------------------- attendees


def test_attendees_list_admitting_tickets_with_summary(client, db, gate, admin, users):
    r = client.get(f"/api/admin/concerts/{gate['concert']}/attendees", headers=bearer(db, admin))
    assert r.status_code == 200
    body = r.json()
    assert body["concert"]["id"] == gate["concert"] and body["concert"]["title"] == "Test Tour"
    assert (body["total"], body["checked_in"], body["not_checked_in"]) == (2, 0, 2)
    # refunded tickets, pending orders and the other concert's tickets are not attendees
    assert {a["ticket_id"] for a in body["items"]} == {t.id for t in gate["valid"]}
    first = body["items"][0]
    assert first["customer"] == {"id": users["a"], "email": "a@test.dev", "full_name": "a"}
    assert (first["zone"], first["row"], first["status"], first["checked_in"]) == ("VIP", "A", "valid", False)
    assert first["ticket_code"] and first["order_number"]


def test_attendees_unknown_concert_404(client, db, admin):
    r = client.get("/api/admin/concerts/999999/attendees", headers=bearer(db, admin))
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


# ----------------------------------------------------------------------- check-in


def test_check_in_by_id_persists(client, db, gate, admin):
    ticket = gate["valid"][0]
    r = checkin(client, db, admin, gate["concert"], ticket.id)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ticket_id"] == ticket.id and body["status"] == "used" and body["checked_in"] is True
    assert body["checked_in_at"]

    # stored in the database: survives a page reload / new request
    assert scalar("SELECT status FROM tickets WHERE id = :i", i=ticket.id) == "used"
    assert scalar("SELECT checked_in_at IS NOT NULL FROM tickets WHERE id = :i", i=ticket.id)
    assert scalar("SELECT checked_in_by FROM tickets WHERE id = :i", i=ticket.id) == admin
    listing = client.get(f"/api/admin/concerts/{gate['concert']}/attendees", headers=bearer(db, admin)).json()
    assert (listing["checked_in"], listing["not_checked_in"]) == (1, 1)
    assert next(a for a in listing["items"] if a["ticket_id"] == ticket.id)["checked_in_at"] == body["checked_in_at"]


@pytest.mark.parametrize("form", ["code", "numeric_string", "padded_code"])
def test_check_in_accepts_ticket_code_or_numeric_string(client, db, gate, admin, form):
    ticket = gate["valid"][1]
    ref = {"code": ticket.ticket_code, "numeric_string": str(ticket.id), "padded_code": f"  {ticket.ticket_code} "}[form]
    r = checkin(client, db, admin, gate["concert"], ref)
    assert r.status_code == 200 and r.json()["ticket_id"] == ticket.id


def test_second_check_in_is_409(client, db, gate, admin):
    ticket = gate["valid"][0]
    first = checkin(client, db, admin, gate["concert"], ticket.id).json()
    r = checkin(client, db, admin, gate["concert"], ticket.ticket_code)
    assert r.status_code == 409
    err = r.json()["error"]
    assert err["code"] == "ticket_already_used" and err["checked_in_at"]
    assert scalar("SELECT checked_in_at FROM tickets WHERE id = :i", i=ticket.id).isoformat() == err["checked_in_at"]
    assert first["checked_in_at"]


@pytest.mark.parametrize("ref", [999999, "999999", "CTL-DOES-NOT-EXIST", 2**70, str(2**70)])
def test_unknown_ticket_is_404(client, db, gate, admin, ref):
    r = checkin(client, db, admin, gate["concert"], ref)
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_ticket_of_another_concert_is_400(client, db, gate, admin):
    r = checkin(client, db, admin, gate["concert"], gate["foreign"].ticket_code)
    assert r.status_code == 400
    err = r.json()["error"]
    assert err["code"] == "wrong_concert" and err["ticket_concert_id"] == gate["other"]
    assert scalar("SELECT status FROM tickets WHERE id = :i", i=gate["foreign"].id) == "valid"


@pytest.mark.parametrize("status", ["refunded", "cancelled"])
def test_cancelled_or_refunded_ticket_is_400(client, db, gate, admin, status):
    ticket = gate["refunded"]
    db.execute(text("UPDATE tickets SET status = :s WHERE id = :i"), {"s": status, "i": ticket.id})
    db.commit()
    r = checkin(client, db, admin, gate["concert"], ticket.id)
    assert r.status_code == 400
    assert r.json()["error"] == {
        "code": "ticket_not_valid",
        "message": f"This ticket is {status} and cannot be used.",
        "ticket_status": status,
    }
    assert scalar("SELECT status FROM tickets WHERE id = :i", i=ticket.id) == status


@pytest.mark.parametrize(
    "body",
    [{"ticketId": 1}, {"concertId": 1}, {"ticketId": True, "concertId": 1}, {"ticketId": "  ", "concertId": 1},
     {"ticketId": "x" * 65, "concertId": 1}, {"ticketId": 1, "concertId": 0}],
)
def test_invalid_body_is_422(client, db, admin, body):
    r = client.post("/api/admin/checkin", json=body, headers=bearer(db, admin))
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_cancelling_after_check_in_is_refused(client, db, gate, admin, users):
    ticket = gate["valid"][0]
    checkin(client, db, admin, gate["concert"], ticket.id)
    order_id = scalar("SELECT order_id FROM tickets WHERE id = :i", i=ticket.id)
    r = client.post(f"/api/orders/{order_id}/cancel", headers=bearer(db, users["a"]))
    assert r.status_code == 409 and r.json()["error"]["code"] == "ticket_used"


# -------------------------------------------------------------------- concurrency


@pytest.mark.parametrize("round_", range(3))
def test_simultaneous_check_ins_admit_once(db, gate, admin, round_):
    ticket = gate["valid"][0]
    refs = [ticket.id, ticket.ticket_code] * 5
    results = race([lambda s, r=r: checkin_svc.check_in(s, admin, gate["concert"], r) for r in refs])
    assert len(wins(results)) == 1
    assert {e.code for e in failures(results)} == {"ticket_already_used"}
    assert scalar("SELECT count(*) FROM tickets WHERE status = 'used'") == 1


def test_simultaneous_check_in_and_cancel(db, gate, admin, users):
    """Either the guest gets in (cancel refused) or the order is cancelled (check-in refused)."""
    from app.services import orders as orders_svc

    ticket = gate["valid"][0]
    order_id = scalar("SELECT order_id FROM tickets WHERE id = :i", i=ticket.id)
    results = race([
        lambda s: checkin_svc.check_in(s, admin, gate["concert"], ticket.id),
        lambda s: orders_svc.cancel_order(s, users["a"], order_id),
    ])
    assert len(wins(results)) == 1
    status = scalar("SELECT status FROM tickets WHERE id = :i", i=ticket.id)
    order = scalar("SELECT status FROM orders WHERE id = :i", i=order_id)
    assert (status, order) in {("used", "paid"), ("refunded", "cancelled")}
