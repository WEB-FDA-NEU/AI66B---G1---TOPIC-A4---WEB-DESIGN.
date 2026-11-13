"""Order and ticket management (#43)."""
import pytest
from sqlalchemy import text

from app.database import engine
from app.errors import DomainError
from app.services import checkout as checkout_svc
from app.services import orders as orders_svc
from app.services import reservations as res_svc
from tests.conftest import scalar


def seat_status(seat_id):
    return scalar("SELECT status FROM seats WHERE id = :i", i=seat_id)


def pay(db, user, reservation, method="card"):
    return checkout_svc.checkout(db, user, reservation.id, method)


# ---------------------------------------------------------- orders & tickets (#43)

def paid_order(db, users, concert, seat_ids, who="a", idx=(0,)):
    view = res_svc.hold_seats(db, users[who], concert, [seat_ids[i] for i in idx])
    return pay(db, users[who], view)


def test_listing_and_ownership_isolation(db, users, concert, seat_ids):
    o1 = paid_order(db, users, concert, seat_ids, "a", (0, 1))
    paid_order(db, users, concert, seat_ids, "b", (5,))
    mine = orders_svc.list_orders(db, users["a"])
    assert [o["id"] for o in mine] == [o1["id"]] and mine[0]["ticket_count"] == 2
    assert len(orders_svc.list_tickets(db, users["a"])) == 2
    assert orders_svc.list_orders(db, users["a"], status="cancelled") == []
    with pytest.raises(DomainError) as e:
        orders_svc.get_order(db, users["b"], o1["id"])
    assert e.value.status_code == 404
    assert orders_svc.get_order(db, users["staff"], o1["id"], "staff")["id"] == o1["id"]
    with pytest.raises(DomainError):
        orders_svc.get_ticket(db, users["b"], o1["tickets"][0]["id"])


def test_cancel_refunds_and_frees_seats_for_resale(db, users, concert, seat_ids):
    order = paid_order(db, users, concert, seat_ids, "a", (0, 1))
    assert order["can_cancel"] is True
    done = orders_svc.cancel_order(db, users["a"], order["id"], "change of plans")
    assert done["status"] == "cancelled" and done["payment_status"] == "refunded"
    assert done["refund_status"] == "refunded" and done["refund_amount"] == 2000
    assert done["refunded_at"] is not None and done["refund_reason"] == "change of plans"
    assert {t["status"] for t in done["tickets"]} == {"refunded"} and done["can_cancel"] is False
    assert seat_status(seat_ids[0]) == "available"
    # seat can be bought again and gets a fresh valid ticket (partial unique index allows it)
    again = paid_order(db, users, concert, seat_ids, "b", (0,))
    assert again["tickets"][0]["status"] == "valid"


def test_cancel_rules(db, users, concert, seat_ids):
    order = paid_order(db, users, concert, seat_ids, "a", (0,))
    with pytest.raises(DomainError) as e:
        orders_svc.cancel_order(db, users["b"], order["id"])
    assert e.value.status_code == 404
    orders_svc.cancel_order(db, users["a"], order["id"])
    with pytest.raises(DomainError) as e:
        orders_svc.cancel_order(db, users["a"], order["id"])
    assert e.value.code == "already_cancelled"

    late = paid_order(db, users, concert, seat_ids, "a", (1,))
    with engine.begin() as conn:
        conn.execute(text("UPDATE concerts SET starts_at = now() + interval '23 hours'"))
    with pytest.raises(DomainError) as e:
        orders_svc.cancel_order(db, users["a"], late["id"])
    assert e.value.code == "cancel_window_closed"
    assert orders_svc.get_order(db, users["a"], late["id"])["can_cancel"] is False
    assert seat_status(seat_ids[1]) == "sold"
    with engine.begin() as conn:  # a cancelled concert is always refundable
        conn.execute(text("UPDATE concerts SET status='cancelled'"))
    assert orders_svc.cancel_order(db, users["a"], late["id"])["refund_status"] == "refunded"


def test_cannot_cancel_after_check_in(db, users, concert, seat_ids):
    order = paid_order(db, users, concert, seat_ids, "a", (0,))
    orders_svc.check_in_ticket(db, users["staff"], order["tickets"][0]["ticket_code"])
    with pytest.raises(DomainError) as e:
        orders_svc.cancel_order(db, users["a"], order["id"])
    assert e.value.code == "ticket_used"


def test_check_in_flow(db, users, concert, seat_ids):
    order = paid_order(db, users, concert, seat_ids, "a", (0,))
    code = order["tickets"][0]["ticket_code"]
    ticket = orders_svc.check_in_ticket(db, users["staff"], code)
    assert ticket["status"] == "used" and ticket["checked_in_at"] is not None
    with pytest.raises(DomainError) as e:
        orders_svc.check_in_ticket(db, users["staff"], code)
    assert e.value.code == "ticket_already_used"
    with pytest.raises(DomainError) as e:
        orders_svc.check_in_ticket(db, users["staff"], "CTL-NOPE")
    assert e.value.status_code == 404
    with pytest.raises(DomainError) as e:
        orders_svc.require_staff("customer")
    assert e.value.status_code == 403


def test_refunded_ticket_cannot_check_in(db, users, concert, seat_ids):
    order = paid_order(db, users, concert, seat_ids, "a", (0,))
    orders_svc.cancel_order(db, users["a"], order["id"])
    with pytest.raises(DomainError) as e:
        orders_svc.check_in_ticket(db, users["staff"], order["tickets"][0]["ticket_code"])
    assert e.value.code == "ticket_not_valid"


def test_database_invariant_sold_seat_always_has_exactly_one_active_ticket(db, users, concert, seat_ids):
    paid_order(db, users, concert, seat_ids, "a", (0, 1, 2))
    bad = scalar(
        "SELECT count(*) FROM seats s WHERE (s.status='sold') <> EXISTS "
        "(SELECT 1 FROM tickets t WHERE t.seat_id=s.id AND t.status IN ('valid','used'))"
    )
    assert bad == 0


@pytest.mark.parametrize('concert_status,hours,seconds,allowed', [
    ('on_sale',24,1,True), ('on_sale',24,0,False), ('on_sale',23,59,False),
    ('cancelled',24,1,True), ('cancelled',24,0,True),
    ('cancelled',1,0,True), ('cancelled',-1,0,True),
])
def test_cancel_hint_matches_api_cutoff_and_cancelled_concert(db, users, concert, seat_ids, monkeypatch, concert_status, hours, seconds, allowed):
    from datetime import datetime, timedelta, timezone
    from fastapi.testclient import TestClient
    from app.main import app
    from app.models import Concert
    order=paid_order(db, users, concert, seat_ids, 'a', (0,))
    now=datetime.now(timezone.utc)
    event=db.get(Concert,concert)
    event.status=concert_status
    event.starts_at=now+timedelta(hours=hours,seconds=seconds)
    db.commit()
    monkeypatch.setattr(orders_svc,'db_now',lambda session:now)
    with TestClient(app) as client:
        headers={'X-User-Id':str(users['a'])}
        read=client.get(f'/api/orders/{order["id"]}',headers=headers)
        assert read.status_code==200 and read.json()['can_cancel'] is allowed
        # An administrative exception to the cutoff never grants another buyer access.
        assert client.post(f'/api/orders/{order["id"]}/cancel',headers={'X-User-Id':str(users['b'])}).status_code==404
        result=client.post(f'/api/orders/{order["id"]}/cancel',headers=headers)
        if allowed:
            assert result.status_code==200
            assert result.json()['refund_status']=='refunded' and result.json()['can_cancel'] is False
            assert result.json()['refund_amount']==order['total_amount']
            assert seat_status(seat_ids[0])=='available'
        else:
            assert result.status_code==409 and result.json()['error']['code']=='cancel_window_closed'


def test_cancelled_concert_still_blocks_used_ticket_and_closed_orders(db, users, concert, seat_ids):
    from app.models import Concert
    order=paid_order(db, users, concert, seat_ids, 'a', (0,))
    orders_svc.check_in_ticket(db,users['staff'],order['tickets'][0]['ticket_code'])
    event=db.get(Concert,concert);event.status='cancelled';db.commit()
    assert orders_svc.get_order(db,users['a'],order['id'])['can_cancel'] is False
    with pytest.raises(DomainError) as error:
        orders_svc.cancel_order(db,users['a'],order['id'])
    assert error.value.code=='ticket_used'
    for status in ['cancelled','failed']:
        from types import SimpleNamespace
        assert orders_svc.can_cancel(SimpleNamespace(status=status),event,[],None) is False
