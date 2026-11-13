"""Seat holds (tasks #40 and #41).

Concurrency model
-----------------
Every mutation locks the affected seat rows with ``SELECT ... FOR UPDATE`` in ascending
id order, then locks the reservation/order rows. Using one global lock order
(seats -> reservation -> order -> concert) means two transactions can never wait on each
other in a cycle; ``transactional`` additionally retries on the rare deadlock anyway.

The loser of a race blocks on the seat row until the winner commits, re-reads the row
under READ COMMITTED, sees ``status = 'held'`` and fails with ``seat_unavailable``.
Expiry is enforced lazily (a held seat whose ``held_until`` has passed is treated as
free and released by whoever touches it next) and eagerly by ``expire_stale_holds``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import MAX_SEATS_PER_RESERVATION, RESERVATION_TTL
from app.errors import DomainError, bad_request, conflict, not_found
from app.models import Concert, Reservation, Seat, Zone
from app.services.txn import transactional
from app.venue_catalog import booking_type


@dataclass
class SeatView:
    id: int
    zone_id: int
    zone_name: str
    row_label: str | None
    seat_number: int | None
    price: Decimal
    booking_type: str = "seated"


@dataclass
class ReservationView:
    id: UUID
    concert_id: int
    status: str
    expires_at: datetime
    seats: list[SeatView] = field(default_factory=list)

    @property
    def total_amount(self) -> Decimal:
        return sum((s.price for s in self.seats), Decimal(0))


def db_now(db: Session) -> datetime:
    """Wall-clock time from the database (not the transaction start time).

    Using ``clock_timestamp()`` matters: a transaction that waited on a row lock must
    judge expiry by the time it actually runs, and one clock avoids app/DB drift.
    """
    return db.execute(select(func.clock_timestamp())).scalar_one()


def lock_seats(db: Session, seat_ids) -> list[Seat]:
    """Lock seats in ascending id order and return their freshly read state."""
    ids = sorted(set(seat_ids))
    if not ids:
        return []
    stmt = (
        select(Seat)
        .where(Seat.id.in_(ids))
        .order_by(Seat.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return list(db.execute(stmt).scalars())


def free_seat(seat: Seat) -> None:
    seat.status = "available"
    seat.held_until = None
    seat.reservation_id = None
    seat.updated_at = func.now()


def release_expired(db: Session, seats: list[Seat], now: datetime) -> None:
    """Free already-locked seats whose hold lapsed and expire their reservations."""
    stale = [s for s in seats if s.status == "held" and s.held_until <= now]
    if not stale:
        return
    reservation_ids = {s.reservation_id for s in stale}
    for seat in stale:
        free_seat(seat)
    db.flush()
    db.execute(
        update(Reservation)
        .where(
            Reservation.id.in_(reservation_ids),
            Reservation.status == "active",
            Reservation.expires_at <= now,
        )
        .values(status="expired", updated_at=func.now())
    )


def seat_views(db: Session, seat_ids) -> list[SeatView]:
    rows = db.execute(
        select(Seat.id, Zone.id, Zone.name, Seat.row_label, Seat.seat_number, Zone.price, Zone.concert_id)
        .join(Zone, Zone.id == Seat.zone_id)
        .where(Seat.id.in_(list(seat_ids)))
        .order_by(Zone.id, Seat.row_label, Seat.seat_number)
    ).all()
    return [SeatView(r[0], r[1], r[2], r[3] if booking_type(r[6], r[2]) == "seated" else None,
                     r[4] if booking_type(r[6], r[2]) == "seated" else None, r[5], booking_type(r[6], r[2])) for r in rows]


@transactional
def hold_tickets(db: Session, user_id: int, concert_id: int, seat_ids: list[int], standing: list[tuple[int, int]]) -> ReservationView:
    """Reserve numbered seats and/or standing quantities in one transaction.

    Existing standing Seat rows are inventory units, never public seat assignments.
    Lock the entire relevant inventory and the previous hold in the same ID order
    as hold_seats, then reuse its expiry, validation and all-or-nothing assignment.
    """
    count = len(seat_ids) + sum(quantity for _, quantity in standing)
    if not 1 <= count <= MAX_SEATS_PER_RESERVATION or any(not 1 <= q <= MAX_SEATS_PER_RESERVATION for _, q in standing):
        raise bad_request("too_many_seats", "Select 1–8 tickets in total.")
    if len(set(seat_ids)) != len(seat_ids) or len({z for z, _ in standing}) != len(standing):
        raise bad_request("duplicate_seats", "Duplicate seats or standing zones.")
    # Serialize replacement requests for the same user/concert without locking users
    # or interfering with the global seats -> reservation -> order lock sequence.
    db.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(f"hold:{user_id}:{concert_id}", 0))))
    requested_zones = {z for z, _ in standing}
    zones = {z.id: z for z in db.execute(select(Zone).where(Zone.id.in_(requested_zones))).scalars()}
    for zone_id in requested_zones:
        if zone_id not in zones or zones[zone_id].concert_id != concert_id:
            raise bad_request("seat_wrong_concert", "Standing zone does not belong to this concert.")
        if zones[zone_id].booking_type != "standing":
            raise bad_request("zone_requires_seats", "Select specific seats in this seated zone.")
    explicit = db.execute(select(Seat.id, Zone.concert_id, Zone.name).join(Zone, Zone.id == Seat.zone_id).where(Seat.id.in_(seat_ids))).all()
    if any(booking_type(cid, name) == "standing" for _, cid, name in explicit):
        raise bad_request("zone_requires_quantity", "Standing zones are booked by quantity, not seat IDs.")
    previous = select(Reservation.id).where(Reservation.user_id == user_id, Reservation.concert_id == concert_id, Reservation.status == "active")
    old_ids = list(db.execute(select(Seat.id).where(Seat.reservation_id.in_(previous))).scalars())
    pool_ids = list(db.execute(select(Seat.id).where(Seat.zone_id.in_(requested_zones))).scalars())
    locked = lock_seats(db, [*seat_ids, *old_ids, *pool_ids])
    now = db_now(db)
    previous_ids = set(db.execute(previous).scalars())
    allocated = []
    for zone_id, quantity in standing:
        candidates = [s.id for s in locked if s.zone_id == zone_id and (
            s.status == "available" or (s.status == "held" and (s.held_until <= now or s.reservation_id in previous_ids))
        )]
        if len(candidates) < quantity:
            raise conflict("standing_unavailable", "Not enough standing tickets remain. Please refresh availability.")
        allocated.extend(candidates[:quantity])
    # No nested commit: both modes become a single reservation or neither does.
    return hold_seats.__wrapped__(db, user_id, concert_id, [*seat_ids, *allocated])


@transactional
def hold_seats(
    db: Session,
    user_id: int,
    concert_id: int,
    seat_ids: list[int],
    ttl: timedelta | None = None,
) -> ReservationView:
    """Atomically hold ``seat_ids`` for ``user_id`` for ``ttl`` (default 5 minutes).

    All-or-nothing: if any requested seat is unavailable nothing is held. A user keeps at
    most one active hold per concert, so a new hold replaces their previous one.
    """
    if not seat_ids:
        raise bad_request("no_seats", "Select at least one seat.")
    if len(set(seat_ids)) != len(seat_ids):
        raise bad_request("duplicate_seats", "Duplicate seats in request.")
    if len(seat_ids) > MAX_SEATS_PER_RESERVATION:
        raise bad_request(
            "too_many_seats",
            f"You can hold at most {MAX_SEATS_PER_RESERVATION} seats at once.",
        )

    concert = db.get(Concert, concert_id, populate_existing=True)
    if concert is None:
        raise not_found("Concert not found.")
    now = db_now(db)
    if concert.status != "on_sale":
        raise conflict("concert_not_on_sale", "This concert is not on sale.")
    if concert.sale_start_at and now < concert.sale_start_at:
        raise conflict("sale_not_started", "Ticket sales have not started yet.")
    if (concert.sale_end_at and now > concert.sale_end_at) or now >= concert.starts_at:
        raise conflict("sale_ended", "Ticket sales for this concert have ended.")

    # The user's previous active hold(s) on this concert are replaced; include their seats
    # in the single ordered lock so we never lock seats in two phases.
    old_reservation_ids = list(
        db.execute(
            select(Reservation.id).where(
                Reservation.user_id == user_id,
                Reservation.concert_id == concert_id,
                Reservation.status == "active",
            )
        ).scalars()
    )
    old_seat_ids = (
        list(db.execute(select(Seat.id).where(Seat.reservation_id.in_(old_reservation_ids))).scalars())
        if old_reservation_ids
        else []
    )

    locked = {s.id: s for s in lock_seats(db, [*seat_ids, *old_seat_ids])}
    # A request may have waited for locks; start the five-minute hold from now.
    now = db_now(db)
    if (concert.sale_end_at and now > concert.sale_end_at) or now >= concert.starts_at:
        raise conflict("sale_ended", "Ticket sales for this concert have ended.")
    release_expired(db, list(locked.values()), now)

    if old_reservation_ids:
        old = (
            db.execute(
                select(Reservation)
                .where(Reservation.id.in_(old_reservation_ids), Reservation.status == "active")
                .order_by(Reservation.id)
                .with_for_update()
                .execution_options(populate_existing=True)
            )
            .scalars()
            .all()
        )
        replaced = {r.id for r in old}
        for r in old:
            r.status = "cancelled"
            r.updated_at = func.now()
        for seat in locked.values():
            if seat.status == "held" and seat.reservation_id in replaced:
                free_seat(seat)

    missing = [i for i in seat_ids if i not in locked]
    if missing:
        raise bad_request("seat_not_found", "Some seats do not exist.", seat_ids=missing)

    zone_concerts = dict(
        db.execute(
            select(Zone.id, Zone.concert_id).where(Zone.id.in_({locked[i].zone_id for i in seat_ids}))
        ).all()
    )
    foreign = [i for i in seat_ids if zone_concerts[locked[i].zone_id] != concert_id]
    if foreign:
        raise bad_request("seat_wrong_concert", "Some seats belong to another concert.", seat_ids=foreign)

    unavailable = [i for i in seat_ids if locked[i].status != "available"]
    if unavailable:
        raise conflict(
            "seat_unavailable",
            "Some seats are no longer available.",
            seat_ids=sorted(unavailable),
        )

    expires_at = now + (ttl or RESERVATION_TTL)
    reservation = Reservation(user_id=user_id, concert_id=concert_id, expires_at=expires_at)
    db.add(reservation)
    db.flush()  # server generates the UUID
    for seat_id in seat_ids:
        seat = locked[seat_id]
        seat.status = "held"
        seat.held_until = expires_at
        seat.reservation_id = reservation.id
        seat.updated_at = func.now()
    db.flush()

    return ReservationView(
        id=reservation.id,
        concert_id=concert_id,
        status="active",
        expires_at=expires_at,
        seats=seat_views(db, seat_ids),
    )


def load_owned_reservation(
    db: Session, reservation_id: UUID, user_id: int
) -> tuple[Reservation, list[Seat]]:
    """Lock the reservation's seats, then the reservation (global lock order).

    A reservation owned by someone else is reported as missing so ids cannot be probed.
    """
    seat_ids = list(
        db.execute(select(Seat.id).where(Seat.reservation_id == reservation_id)).scalars()
    )
    seats = lock_seats(db, seat_ids)
    reservation = db.execute(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if reservation is None or reservation.user_id != user_id:
        raise not_found("Reservation not found.")
    return reservation, seats


@transactional
def release_reservation(db: Session, reservation_id: UUID, user_id: int) -> ReservationView:
    """Voluntarily give up a hold; idempotent for already-released holds."""
    reservation, seats = load_owned_reservation(db, reservation_id, user_id)
    if reservation.status == "converted":
        raise conflict("reservation_converted", "This reservation has already been paid.")
    if reservation.status == "active":
        reservation.status = "cancelled"
        reservation.updated_at = func.now()
        for seat in seats:
            if seat.status == "held" and seat.reservation_id == reservation.id:
                free_seat(seat)
    return ReservationView(
        id=reservation.id,
        concert_id=reservation.concert_id,
        status=reservation.status,
        expires_at=reservation.expires_at,
    )


@transactional
def get_reservation(db: Session, reservation_id: UUID, user_id: int) -> ReservationView:
    """Return a hold, lazily expiring it so clients never see a stale 'active' status."""
    reservation, seats = load_owned_reservation(db, reservation_id, user_id)
    now = db_now(db)
    if reservation.status == "active" and reservation.expires_at <= now:
        release_expired(db, seats, now)
        reservation.status = "expired"
        reservation.updated_at = func.now()
    views = seat_views(db, [s.id for s in seats]) if reservation.status == "active" else []
    return ReservationView(
        id=reservation.id,
        concert_id=reservation.concert_id,
        status=reservation.status,
        expires_at=reservation.expires_at,
        seats=views,
    )


@transactional
def expire_stale_holds(db: Session, batch: int = 500) -> int:
    """Release every hold whose time is up. Safe to run concurrently from many workers.

    ``SKIP LOCKED`` lets a sweeper ignore seats another transaction is working on instead
    of queueing behind it; those seats are handled lazily by that transaction.
    """
    now = db_now(db)
    stale = list(
        db.execute(
            select(Seat)
            .where(Seat.status == "held", Seat.held_until <= now)
            .order_by(Seat.id)
            .limit(batch)
            .with_for_update(skip_locked=True)
            .execution_options(populate_existing=True)
        ).scalars()
    )
    release_expired(db, stale, now)
    return len(stale)


def assert_payable(reservation: Reservation, now: datetime) -> None:
    """Used by checkout: raise the right error for a reservation that cannot be paid."""
    if reservation.status == "converted":
        raise conflict("reservation_converted", "This reservation has already been paid.")
    if reservation.status != "active" or reservation.expires_at <= now:
        raise DomainError(410, "reservation_expired", "Your seat hold has expired.")
