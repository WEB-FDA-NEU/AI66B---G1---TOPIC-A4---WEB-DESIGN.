"""Mock checkout (#42)."""
import pytest

from app.errors import DomainError
from app.services import checkout as checkout_svc
from app.services import orders as orders_svc
from app.services import reservations as res_svc
from tests.conftest import expire_reservation, scalar


def seat_status(seat_id):
    return scalar("SELECT status FROM seats WHERE id = :i", i=seat_id)


# ------------------------------------------------------------------- checkout (#42)

def pay(db, user, reservation, method="card"):
    return checkout_svc.checkout(db, user, reservation.id, method)


def test_checkout_creates_paid_order_tickets_and_sells_seats(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0], seat_ids[10]])
    order = pay(db, users["a"], view, "ewallet")
    assert order["status"] == "paid" and order["payment_status"] == "paid"
    assert order["total_amount"] == 1300 and order["order_number"] >= 10483
    assert order["payment_ref"].startswith("MOCK-")
    assert len(order["tickets"]) == 2
    assert {t["zone"] for t in order["tickets"]} == {"VIP", "GA"}
    assert len({t["ticket_code"] for t in order["tickets"]}) == 2
    assert all(t["status"] == "valid" for t in order["tickets"])
    assert seat_status(seat_ids[0]) == "sold"
    assert scalar("SELECT held_until IS NULL AND reservation_id IS NULL FROM seats WHERE id=:i", i=seat_ids[0])
    assert scalar("SELECT status FROM reservations WHERE id=:i", i=view.id) == "converted"


def test_checkout_is_idempotent(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    first = pay(db, users["a"], view)
    second = pay(db, users["a"], view)
    assert first["id"] == second["id"]
    assert scalar("SELECT count(*) FROM orders") == 1 and scalar("SELECT count(*) FROM tickets") == 1


def test_checkout_after_expiry_fails_and_releases_seats(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    expire_reservation(view.id)
    with pytest.raises(DomainError) as e:
        pay(db, users["a"], view)
    assert e.value.status_code == 410 and e.value.code == "reservation_expired"
    assert seat_status(seat_ids[0]) == "available"  # persisted even though the call raised
    assert scalar("SELECT status FROM reservations WHERE id=:i", i=view.id) == "expired"
    assert scalar("SELECT count(*) FROM orders") == 0


def test_checkout_rejects_foreign_cancelled_and_bad_method(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    with pytest.raises(DomainError) as e:
        pay(db, users["b"], view)
    assert e.value.status_code == 404
    with pytest.raises(DomainError) as e:
        pay(db, users["a"], view, "bitcoin")
    assert e.value.code == "invalid_payment_method"
    res_svc.release_reservation(db, view.id, users["a"])
    with pytest.raises(DomainError) as e:
        pay(db, users["a"], view)
    assert e.value.code == "reservation_expired"
    assert scalar("SELECT count(*) FROM orders") == 0


def test_last_seat_sold_marks_concert_sold_out_and_cancel_reopens(db, users, concert, seat_ids):
    for start in (0, 8):
        ids = seat_ids[start : start + 8] if start == 0 else seat_ids[8:]
        order = pay(db, users["a"], res_svc.hold_seats(db, users["a"], concert, ids))
    assert scalar("SELECT status FROM concerts WHERE id=:i", i=concert) == "sold_out"
    with pytest.raises(DomainError) as e:
        res_svc.hold_seats(db, users["b"], concert, [seat_ids[0]])
    assert e.value.code == "concert_not_on_sale"
    orders_svc.cancel_order(db, users["a"], order["id"])
    assert scalar("SELECT status FROM concerts WHERE id=:i", i=concert) == "on_sale"
