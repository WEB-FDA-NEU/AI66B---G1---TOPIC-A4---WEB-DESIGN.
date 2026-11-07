"""Order and ticket management (task #43): view, cancel/refund, check-in."""
from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import CANCEL_CUTOFF
from app.errors import conflict, forbidden, not_found
from app.models import Concert, Order, Seat, Ticket, User, Zone
from app.services.reservations import db_now, free_seat, lock_seats
from app.services.txn import transactional

STAFF_ROLES = ("staff", "admin")


# ---------------------------------------------------------------- serialisation

def _ticket_rows(db: Session, *where):
    return db.execute(
        select(Ticket, Seat, Zone, Concert)
        .join(Seat, Seat.id == Ticket.seat_id)
        .join(Zone, Zone.id == Seat.zone_id)
        .join(Concert, Concert.id == Ticket.concert_id)
        .where(*where)
        .order_by(Ticket.id)
    ).all()


def ticket_dict(ticket: Ticket, seat: Seat, zone: Zone, concert: Concert, order: Order | None = None) -> dict:
    data = {
        "id": ticket.id,
        "ticket_code": ticket.ticket_code,
        "order_id": ticket.order_id,
        "concert_id": concert.id,
        "concert_title": concert.title,
        "artist": concert.artist,
        "venue": concert.venue,
        "city": concert.city,
        "starts_at": concert.starts_at,
        "poster_url": concert.poster_url,
        "zone": zone.name,
        "row": seat.row_label,
        "seat_number": seat.seat_number,
        "price": ticket.price,
        "status": ticket.status,
        "checked_in_at": ticket.checked_in_at,
        # What the entrance scanner reads: the ticket code, only while it grants entry.
        "qr_data": ticket.ticket_code if ticket.status == "valid" else None,
    }
    if order is not None:
        data["order_number"] = order.order_number
    return data


def order_summary(order: Order, concert: Concert, ticket_count: int) -> dict:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "concert_id": concert.id,
        "concert_title": concert.title,
        "artist": concert.artist,
        "venue": concert.venue,
        "city": concert.city,
        "poster_url": concert.poster_url,
        "starts_at": concert.starts_at,
        "total_amount": order.total_amount,
        "status": order.status,
        "payment_method": order.payment_method,
        "payment_status": order.payment_status,
        "refund_status": order.refund_status,
        "ticket_count": ticket_count,
        "created_at": order.created_at,
    }


def order_detail(db: Session, order: Order) -> dict:
    concert = db.get(Concert, order.concert_id)
    tickets = [ticket_dict(*row, order=order) for row in _ticket_rows(db, Ticket.order_id == order.id)]
    data = order_summary(order, concert, len(tickets))
    data.update(
        {
            "reservation_id": order.reservation_id,
            "payment_ref": order.payment_ref,
            "paid_at": order.paid_at,
            "refund_amount": order.refund_amount,
            "refund_reason": order.refund_reason,
            "refunded_at": order.refunded_at,
            "tickets": tickets,
            "can_cancel": can_cancel(order, concert, tickets, db_now(db)),
        }
    )
    return data


def can_cancel(order: Order, concert: Concert, tickets: list[dict], now) -> bool:
    if order.status not in ("pending", "paid"):
        return False
    if any(t["status"] == "used" for t in tickets):
        return False
    return concert.starts_at - now > CANCEL_CUTOFF


# ---------------------------------------------------------------------- queries

def list_orders(db: Session, user_id: int, status: str | None = None, limit: int = 50, offset: int = 0):
    count = (
        select(Ticket.order_id, func.count().label("n")).group_by(Ticket.order_id).subquery()
    )
    stmt = (
        select(Order, Concert, func.coalesce(count.c.n, 0))
        .join(Concert, Concert.id == Order.concert_id)
        .outerjoin(count, count.c.order_id == Order.id)
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if status:
        stmt = stmt.where(Order.status == status)
    return [order_summary(o, c, n) for o, c, n in db.execute(stmt).all()]


def get_order(db: Session, user_id: int, order_id: int, role: str = "customer") -> dict:
    order = db.get(Order, order_id)
    # Not-yours looks identical to missing so order ids cannot be enumerated.
    if order is None or (order.user_id != user_id and role not in STAFF_ROLES):
        raise not_found("Order not found.")
    return order_detail(db, order)


def list_tickets(db: Session, user_id: int, status: str | None = None) -> list[dict]:
    where = [Order.user_id == user_id]
    if status:
        where.append(Ticket.status == status)
    rows = db.execute(
        select(Ticket, Seat, Zone, Concert, Order)
        .join(Order, Order.id == Ticket.order_id)
        .join(Seat, Seat.id == Ticket.seat_id)
        .join(Zone, Zone.id == Seat.zone_id)
        .join(Concert, Concert.id == Ticket.concert_id)
        .where(*where)
        .order_by(Concert.starts_at, Ticket.id)
    ).all()
    return [ticket_dict(t, s, z, c, order=o) for t, s, z, c, o in rows]


def get_ticket(db: Session, user_id: int, ticket_id: int, role: str = "customer") -> dict:
    row = db.execute(
        select(Ticket, Seat, Zone, Concert, Order)
        .join(Order, Order.id == Ticket.order_id)
        .join(Seat, Seat.id == Ticket.seat_id)
        .join(Zone, Zone.id == Seat.zone_id)
        .join(Concert, Concert.id == Ticket.concert_id)
        .where(Ticket.id == ticket_id)
    ).first()
    if row is None or (row[4].user_id != user_id and role not in STAFF_ROLES):
        raise not_found("Ticket not found.")
    t, s, z, c, o = row
    data = ticket_dict(t, s, z, c, order=o)
    data["holder_name"] = db.get(User, o.user_id).full_name
    data["qr_image"] = qr_data_uri(data["qr_data"]) if data["qr_data"] else None
    return data


def qr_data_uri(payload: str) -> str:
    """The QR code as an SVG data URI, rendered server-side (no third-party QR service)."""
    import segno

    return segno.make(payload, error="m").svg_data_uri(scale=6, border=2)


# -------------------------------------------------------------------- mutations

@transactional
def cancel_order(db: Session, user_id: int, order_id: int, reason: str | None = None) -> dict:
    """Cancel an order and (if paid) run a mock full refund, freeing its seats.

    Rules: the owner only; not already cancelled; no ticket checked in; and at least
    ``CANCEL_CUTOFF`` before the concert starts. Lock order is seats -> order -> tickets
    -> concert, the same as every other mutation.
    """
    owned = db.execute(select(Order.user_id).where(Order.id == order_id)).scalar_one_or_none()
    if owned is None or owned != user_id:
        raise not_found("Order not found.")

    seat_ids = list(db.execute(select(Ticket.seat_id).where(Ticket.order_id == order_id)).scalars())
    seats = lock_seats(db, seat_ids)
    order = db.execute(
        select(Order).where(Order.id == order_id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one()
    tickets = list(
        db.execute(
            select(Ticket)
            .where(Ticket.order_id == order_id)
            .order_by(Ticket.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).scalars()
    )

    if order.status == "cancelled":
        raise conflict("already_cancelled", "This order is already cancelled.")
    if order.status not in ("pending", "paid"):
        raise conflict("order_not_cancellable", "This order cannot be cancelled.")
    if any(t.status == "used" for t in tickets):
        raise conflict("ticket_used", "A ticket in this order has already been used.")

    concert = db.execute(
        select(Concert)
        .where(Concert.id == order.concert_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).scalar_one()
    now = db_now(db)
    # A cancelled concert is always refundable; otherwise the cut-off applies.
    if concert.status != "cancelled" and concert.starts_at - now <= CANCEL_CUTOFF:
        raise conflict(
            "cancel_window_closed",
            "Orders can no longer be cancelled less than 24 hours before the concert.",
        )

    order.status = "cancelled"
    order.refund_reason = reason
    order.updated_at = func.now()
    if order.payment_status == "paid":
        order.payment_status = "refunded"  # mock gateway: refund always succeeds
        order.refund_status = "refunded"
        order.refund_amount = order.total_amount
        order.refunded_at = now
    for ticket in tickets:
        ticket.status = "refunded" if order.refund_status == "refunded" else "cancelled"
        ticket.updated_at = func.now()
    for seat in seats:
        if seat.status == "sold":
            free_seat(seat)
    if concert.status == "sold_out":
        concert.status = "on_sale"
        concert.updated_at = func.now()
    db.flush()
    return order_detail(db, order)


@transactional
def check_in_ticket(db: Session, staff_id: int, ticket_code: str) -> dict:
    """Validate a scanned QR code. The single conditional UPDATE makes it atomic, so two
    scanners racing on the same ticket cannot both succeed."""
    updated = db.execute(
        update(Ticket)
        .where(Ticket.ticket_code == ticket_code, Ticket.status == "valid")
        .values(status="used", checked_in_at=func.now(), checked_in_by=staff_id, updated_at=func.now())
        .returning(Ticket.id)
    ).scalar_one_or_none()

    row = db.execute(
        select(Ticket, Seat, Zone, Concert, Order)
        .join(Order, Order.id == Ticket.order_id)
        .join(Seat, Seat.id == Ticket.seat_id)
        .join(Zone, Zone.id == Seat.zone_id)
        .join(Concert, Concert.id == Ticket.concert_id)
        .where(Ticket.ticket_code == ticket_code)
    ).first()
    if row is None:
        raise not_found("Ticket not found.")
    if updated is None:
        status = row[0].status
        if status == "used":
            raise conflict("ticket_already_used", "This ticket was already checked in.", checked_in_at=str(row[0].checked_in_at))
        raise conflict("ticket_not_valid", f"This ticket is {status}.")
    return ticket_dict(*row[:4], order=row[4])


def require_staff(role: str) -> None:
    if role not in STAFF_ROLES:
        raise forbidden("Staff access required.")
