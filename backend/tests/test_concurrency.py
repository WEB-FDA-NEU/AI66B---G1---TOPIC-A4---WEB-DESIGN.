"""Task #44: simultaneous bookings. Each worker uses its own DB session (own connection),
released together by a barrier so the transactions genuinely overlap.

The invariants checked after every scenario are the ones that matter to the business:
a seat is never held/sold twice, no partial holds, one order per paid reservation.
"""
import random
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text

from app.database import SessionLocal, engine
from app.errors import DomainError
from app.services import checkout as checkout_svc
from app.services import orders as orders_svc
from app.services import reservations as res_svc
from tests.conftest import expire_reservation, make_user, scalar

REPEAT = 5  # each race is run several times: a lock bug is probabilistic, not deterministic


def race(jobs):
    """Run callables simultaneously; return list of ('ok', value) / ('err', exception)."""
    barrier = threading.Barrier(len(jobs))

    def run(job):
        with SessionLocal() as session:
            barrier.wait(timeout=30)
            try:
                return ("ok", job(session))
            except DomainError as exc:
                return ("err", exc)

    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        return list(pool.map(run, jobs))


def wins(results):
    return [v for kind, v in results if kind == "ok"]


def failures(results):
    return [v for kind, v in results if kind == "err"]


def assert_consistent():
    # no seat is claimed by two live reservations / two active tickets
    assert scalar("SELECT count(*) FROM (SELECT seat_id FROM tickets WHERE status IN ('valid','used') "
                  "GROUP BY seat_id HAVING count(*) > 1) x") == 0
    # every held seat belongs to an active reservation; every active reservation's seats are held
    assert scalar("SELECT count(*) FROM seats s LEFT JOIN reservations r ON r.id = s.reservation_id "
                  "WHERE s.status='held' AND (r.id IS NULL OR r.status <> 'active')") == 0
    assert scalar("SELECT count(*) FROM seats s WHERE (s.status='sold') <> EXISTS "
                  "(SELECT 1 FROM tickets t WHERE t.seat_id=s.id AND t.status IN ('valid','used'))") == 0
    assert scalar("SELECT count(*) FROM (SELECT reservation_id FROM orders WHERE reservation_id IS NOT NULL "
                  "GROUP BY reservation_id HAVING count(*) > 1) x") == 0


@pytest.mark.parametrize("round_", range(REPEAT))
def test_many_users_race_for_one_seat_exactly_one_wins(db, concert, seat_ids, round_):
    users = [make_user(db, f"u{round_}-{i}@test.dev") for i in range(12)]
    results = race([lambda s, u=u: res_svc.hold_seats(s, u, concert, [seat_ids[0]]) for u in users])
    assert len(wins(results)) == 1
    assert {e.code for e in failures(results)} == {"seat_unavailable"}
    assert scalar("SELECT count(*) FROM seats WHERE status='held'") == 1
    assert scalar("SELECT count(*) FROM reservations WHERE status='active'") == 1
    assert_consistent()


@pytest.mark.parametrize("round_", range(REPEAT))
def test_overlapping_multi_seat_requests_are_atomic_and_never_deadlock(db, concert, seat_ids, round_):
    """A wants {0,1,2}, B wants {2,3,4}, C wants {4,0}: any two overlap. Request order is
    deliberately reversed for some users to tempt lock-order inversion."""
    a, b, c = (make_user(db, f"{n}{round_}@test.dev") for n in "abc")
    wanted = [
        (a, [seat_ids[0], seat_ids[1], seat_ids[2]]),
        (b, [seat_ids[4], seat_ids[3], seat_ids[2]]),
        (c, [seat_ids[4], seat_ids[0]]),
    ]
    results = race([lambda s, u=u, ids=ids: res_svc.hold_seats(s, u, concert, ids) for u, ids in wanted])
    won = wins(results)
    assert 1 <= len(won) <= 2
    held_ids = [seat.id for view in won for seat in view.seats]
    assert len(held_ids) == len(set(held_ids)), "a seat was handed to two users"
    assert scalar("SELECT count(*) FROM seats WHERE status='held'") == len(held_ids)  # no partial holds
    assert_consistent()


def test_each_user_replacing_their_hold_concurrently_does_not_deadlock(db, concert, seat_ids):
    """Two users swap into each other's previously held seats at the same time."""
    a, b = make_user(db, "swap-a@test.dev"), make_user(db, "swap-b@test.dev")
    for _ in range(REPEAT):
        res_svc.hold_seats(db, a, concert, [seat_ids[0], seat_ids[1]])
        res_svc.hold_seats(db, b, concert, [seat_ids[2], seat_ids[3]])
        results = race([
            lambda s: res_svc.hold_seats(s, a, concert, [seat_ids[2], seat_ids[3]]),
            lambda s: res_svc.hold_seats(s, b, concert, [seat_ids[0], seat_ids[1]]),
        ])
        assert all(kind in ("ok", "err") for kind, _ in results)
        assert_consistent()


def test_stress_many_users_random_seats_no_double_booking(db, concert, seat_ids):
    rng = random.Random(7)
    users = [make_user(db, f"s{i}@test.dev") for i in range(30)]
    picks = [rng.sample(seat_ids, rng.randint(1, 4)) for _ in users]
    results = race([lambda s, u=u, ids=ids: res_svc.hold_seats(s, u, concert, ids) for u, ids in zip(users, picks)])
    held = [seat.id for view in wins(results) for seat in view.seats]
    assert len(held) == len(set(held))
    assert {e.code for e in failures(results)} <= {"seat_unavailable"}
    assert scalar("SELECT count(*) FROM seats WHERE status='held'") == len(held)
    assert_consistent()


