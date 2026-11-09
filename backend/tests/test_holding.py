"""Seat hold / reservation service (#40, #41)."""
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.database import engine
from app.errors import DomainError
from app.services import reservations as res_svc
from tests.conftest import expire_reservation, scalar


def code_of(exc_info) -> str:
    return exc_info.value.code


def seat_status(seat_id):
    return scalar("SELECT status FROM seats WHERE id = :i", i=seat_id)


# ------------------------------------------------------------------ holding (#40/#41)

def test_hold_marks_seats_held_with_expiry_and_total(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0], seat_ids[10]])
    assert view.status == "active"
    assert view.total_amount == 1300  # VIP 1000 + GA 300
    assert 290 <= (view.expires_at - datetime.now(timezone.utc)).total_seconds() <= 301
    assert seat_status(seat_ids[0]) == "held" and seat_status(seat_ids[10]) == "held"
    assert scalar("SELECT held_until FROM seats WHERE id=:i", i=seat_ids[0]) == view.expires_at


def test_second_user_cannot_take_held_seat(db, users, concert, seat_ids):
    res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    with pytest.raises(DomainError) as e:
        res_svc.hold_seats(db, users["b"], concert, [seat_ids[0]])
    assert e.value.status_code == 409 and code_of(e) == "seat_unavailable"
    assert e.value.details["seat_ids"] == [seat_ids[0]]


def test_hold_is_all_or_nothing(db, users, concert, seat_ids):
    res_svc.hold_seats(db, users["a"], concert, [seat_ids[1]])
    with pytest.raises(DomainError):
        res_svc.hold_seats(db, users["b"], concert, [seat_ids[0], seat_ids[1], seat_ids[2]])
    assert seat_status(seat_ids[0]) == "available" and seat_status(seat_ids[2]) == "available"
    assert scalar("SELECT count(*) FROM reservations WHERE user_id=:u", u=users["b"]) == 0


def test_new_hold_replaces_users_previous_hold_on_same_concert(db, users, concert, seat_ids):
    first = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    second = res_svc.hold_seats(db, users["a"], concert, [seat_ids[1]])
    assert seat_status(seat_ids[0]) == "available"
    assert seat_status(seat_ids[1]) == "held"
    assert scalar("SELECT status FROM reservations WHERE id=:i", i=first.id) == "cancelled"
    assert second.status == "active"


def test_user_can_reselect_overlapping_seats(db, users, concert, seat_ids):
    res_svc.hold_seats(db, users["a"], concert, [seat_ids[0], seat_ids[1]])
    again = res_svc.hold_seats(db, users["a"], concert, [seat_ids[1], seat_ids[2]])
    assert {s.id for s in again.seats} == {seat_ids[1], seat_ids[2]}
    assert seat_status(seat_ids[0]) == "available"


@pytest.mark.parametrize(
    "ids,code",
    [([], "no_seats"), ([1, 1], "duplicate_seats"), (list(range(1, 10)), "too_many_seats"), ([999999], "seat_not_found")],
)
def test_hold_input_validation(db, users, concert, seat_ids, ids, code):
    with pytest.raises(DomainError) as e:
        res_svc.hold_seats(db, users["a"], concert, ids)
    assert e.value.code == code


def test_hold_rejects_unknown_concert_and_wrong_concert_seats(db, users, concert, seat_ids):
    with pytest.raises(DomainError) as e:
        res_svc.hold_seats(db, users["a"], 12345, [seat_ids[0]])
    assert e.value.status_code == 404
    with engine.begin() as conn:
        other = conn.execute(
            text(
                "INSERT INTO concerts(title,artist,venue,city,starts_at,status) "
                "VALUES ('o','o','o','o', now()+interval '9 days','on_sale') RETURNING id"
            )
        ).scalar_one()
    with pytest.raises(DomainError) as e:
        res_svc.hold_seats(db, users["a"], other, [seat_ids[0]])
    assert e.value.code == "seat_wrong_concert"


@pytest.mark.parametrize(
    "sql,code",
    [
        ("UPDATE concerts SET status='draft'", "concert_not_on_sale"),
        ("UPDATE concerts SET status='sold_out'", "concert_not_on_sale"),
        ("UPDATE concerts SET sale_start_at = now() + interval '1 day'", "sale_not_started"),
        ("UPDATE concerts SET sale_start_at = now() - interval '2 day', sale_end_at = now() - interval '1 day'", "sale_ended"),
        ("UPDATE concerts SET starts_at = now() - interval '1 hour', sale_start_at = NULL", "sale_ended"),
    ],
)
def test_hold_respects_sale_state(db, users, concert, seat_ids, sql, code):
    with engine.begin() as conn:
        conn.execute(text(sql))
    with pytest.raises(DomainError) as e:
        res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    assert e.value.code == code


def test_expired_hold_frees_seat_lazily_for_another_user(db, users, concert, seat_ids):
    old = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    expire_reservation(old.id)
    new = res_svc.hold_seats(db, users["b"], concert, [seat_ids[0]])  # no sweeper involved
    assert new.status == "active"
    assert scalar("SELECT status FROM reservations WHERE id=:i", i=old.id) == "expired"
    assert scalar("SELECT user_id FROM reservations WHERE id=:i", i=new.id) == users["b"]


def test_sweeper_releases_only_expired_holds(db, users, concert, seat_ids):
    gone = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0], seat_ids[1]])
    live = res_svc.hold_seats(db, users["b"], concert, [seat_ids[2]])
    expire_reservation(gone.id)
    assert res_svc.expire_stale_holds(db) == 2
    assert seat_status(seat_ids[0]) == "available" and seat_status(seat_ids[1]) == "available"
    assert seat_status(seat_ids[2]) == "held"
    assert scalar("SELECT status FROM reservations WHERE id=:i", i=gone.id) == "expired"
    assert scalar("SELECT status FROM reservations WHERE id=:i", i=live.id) == "active"
    assert res_svc.expire_stale_holds(db) == 0


def test_get_reservation_reports_expiry_and_hides_others(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    assert res_svc.get_reservation(db, view.id, users["a"]).status == "active"
    with pytest.raises(DomainError) as e:
        res_svc.get_reservation(db, view.id, users["b"])
    assert e.value.status_code == 404
    expire_reservation(view.id)
    got = res_svc.get_reservation(db, view.id, users["a"])
    assert got.status == "expired" and got.seats == []
    assert seat_status(seat_ids[0]) == "available"


def test_release_frees_seats_and_is_idempotent(db, users, concert, seat_ids):
    view = res_svc.hold_seats(db, users["a"], concert, [seat_ids[0]])
    assert res_svc.release_reservation(db, view.id, users["a"]).status == "cancelled"
    assert seat_status(seat_ids[0]) == "available"
    assert res_svc.release_reservation(db, view.id, users["a"]).status == "cancelled"
    with pytest.raises(DomainError):
        res_svc.release_reservation(db, view.id, users["b"])
