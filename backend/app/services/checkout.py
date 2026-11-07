"""Mock checkout (task #42): turns a live seat hold into a paid order plus tickets."""
from __future__ import annotations

import uuid
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import PAYMENT_METHODS
from app.errors import bad_request, conflict
from app.models import Concert, Order, Seat, Ticket, Zone
from app.services import orders as order_service
from app.services.reservations import (
    assert_payable,
    db_now,
    load_owned_reservation,
    release_expired,
)
from app.services.txn import transactional


def new_ticket_code() -> str:
    """Unguessable code embedded in the QR; uniqueness is also enforced by the DB."""
    return f"CTL-{uuid.uuid4().hex.upper()}"


@transactional
def checkout(db: Session, user_id: int, reservation_id: UUID, payment_method: str) -> dict:
    """Pay for a reservation. Idempotent: repeating it returns the order already created.

    The seats are re-verified under lock right before the order is written, so an order
    can only ever be created for seats that are still held by this very reservation.
    """
    if payment_method not in PAYMENT_METHODS:
        raise bad_request(
            "invalid_payment_method",
            f"Payment method must be one of: {', '.join(PAYMENT_METHODS)}.",
        )

    reservation, seats = load_owned_reservation(db, reservation_id, user_id)

    if reservation.status == "converted":
        existing = db.execute(
            select(Order).where(Order.reservation_id == reservation.id)
        ).scalar_one_or_none()
        if existing is not None:
            return order_service.order_detail(db, existing)

    now = db_now(db)
    try:
        assert_payable(reservation, now)
    except Exception:
        if reservation.status == "active":  # time ran out: free the seats for others
            release_expired(db, seats, now)
            reservation.status = "expired"
            reservation.updated_at = func.now()
            db.commit()
        raise

    seats_ok = (
        seats
        and all(
            s.status == "held" and s.reservation_id == reservation.id and s.held_until > now
            for s in seats
        )
    )
    if not seats_ok:
        raise conflict("seat_unavailable", "Your seats are no longer held. Please select again.")

    prices = dict(
        db.execute(
            select(Seat.id, Zone.price).join(Zone, Zone.id == Seat.zone_id).where(
                Seat.id.in_([s.id for s in seats])
            )
        ).all()
    )
    total = sum(prices.values())

    order = Order(
        user_id=user_id,
        concert_id=reservation.concert_id,
        reservation_id=reservation.id,
        total_amount=total,
        status="paid",
        payment_method=payment_method,
        payment_status="paid",
        payment_ref=f"MOCK-{uuid.uuid4().hex[:12].upper()}",  # no real gateway is called
        paid_at=now,
    )
    db.add(order)
    db.flush()
    db.refresh(order)  # pick up the server-generated order_number

    for seat in seats:
        db.add(
            Ticket(
                order_id=order.id,
                concert_id=reservation.concert_id,
                seat_id=seat.id,
                ticket_code=new_ticket_code(),
                price=prices[seat.id],
            )
        )
        seat.status = "sold"
        seat.held_until = None
        seat.reservation_id = None
        seat.updated_at = func.now()
    reservation.status = "converted"
    reservation.updated_at = func.now()
    db.flush()

    unsold = db.execute(
        select(func.count())
        .select_from(Seat)
        .join(Zone, Zone.id == Seat.zone_id)
        .where(Zone.concert_id == reservation.concert_id, Seat.status != "sold")
    ).scalar_one()
    if unsold == 0:
        concert = db.get(Concert, reservation.concert_id)
        concert.status = "sold_out"
        concert.updated_at = func.now()
        db.flush()

    return order_service.order_detail(db, order)

