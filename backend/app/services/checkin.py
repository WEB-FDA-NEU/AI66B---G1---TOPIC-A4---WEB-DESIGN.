"""Admin attendee list and gate check-in (issue #36).

A ticket is admitted at most once: the check-in is a single conditional UPDATE
(``... WHERE status = 'valid' AND concert_id = :concert``), so when two scanners race on
the same ticket exactly one UPDATE matches and the other request sees ``used`` (409).
The check-in time is stored in ``tickets.checked_in_at`` (the schema's "used at"
column) together with ``checked_in_by``.

Errors: unknown ticket -> 404; ticket of another concert -> 400 ``wrong_concert``;
cancelled/refunded ticket -> 400 ``ticket_not_valid``; already used -> 409
``ticket_already_used``.
"""
from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.errors import bad_request, conflict, not_found
from app.models import Concert, Order, Seat, Ticket, User, Zone
from app.services.txn import transactional

ATTENDEE_STATUSES = ("valid", "used")
MAX_BIGINT = 2**63 - 1


def _attendee(ticket: Ticket, seat: Seat, zone: Zone, order: Order, user: User) -> dict:
    return {
        "ticket_id": ticket.id,
        "ticket_code": ticket.ticket_code,
        "status": ticket.status,
        "checked_in": ticket.status == "used",
        "checked_in_at": ticket.checked_in_at,
        "zone": zone.name,
        "row": seat.row_label if zone.booking_type == "seated" else None,
        "seat_number": seat.seat_number if zone.booking_type == "seated" else None,
        "booking_type": zone.booking_type,
        "price": ticket.price,
        "order_id": order.id,
        "order_number": order.order_number,
        "customer": {"id": user.id, "email": user.email, "full_name": user.full_name},
    }


def _rows(db: Session, *where):
    return db.execute(
        select(Ticket, Seat, Zone, Order, User)
        .join(Seat, Seat.id == Ticket.seat_id)
        .join(Zone, Zone.id == Seat.zone_id)
        .join(Order, Order.id == Ticket.order_id)
        .join(User, User.id == Order.user_id)
        .where(*where)
        .order_by(User.full_name, Ticket.id)
        .execution_options(populate_existing=True)  # see the row as the UPDATE left it
    ).all()


def attendees(db: Session, concert_id: int) -> dict:
    """Everyone holding an admitting ticket (valid or used) for the concert."""
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise not_found("Concert not found.")
    items = [
        _attendee(*row)
        for row in _rows(db, Ticket.concert_id == concert_id, Ticket.status.in_(ATTENDEE_STATUSES))
    ]
    checked_in = sum(1 for a in items if a["checked_in"])
    return {
        "concert": {
            "id": concert.id,
            "title": concert.title,
            "venue": concert.venue,
            "starts_at": concert.starts_at,
            "status": concert.status,
        },
        "total": len(items),
        "checked_in": checked_in,
        "not_checked_in": len(items) - checked_in,
        "items": items,
    }


def _ticket_filter(ticket_ref: int | str):
    """Numeric references are ticket ids (attendee table); anything else is the QR code."""
    if isinstance(ticket_ref, str) and ticket_ref.strip().isdigit():
        ticket_ref = int(ticket_ref.strip())
    if isinstance(ticket_ref, int):
        # ids beyond BIGINT cannot exist; compare against an impossible id instead of overflowing
        return Ticket.id == (ticket_ref if 0 < ticket_ref <= MAX_BIGINT else -1)
    return Ticket.ticket_code == ticket_ref.strip()


@transactional
def check_in(db: Session, admin_id: int, concert_id: int, ticket_ref: int | str) -> dict:
    where = _ticket_filter(ticket_ref)
    updated = db.execute(
        update(Ticket)
        .where(where, Ticket.concert_id == concert_id, Ticket.status == "valid")
        .values(status="used", checked_in_at=func.now(), checked_in_by=admin_id, updated_at=func.now())
        .returning(Ticket.id)
    ).scalar_one_or_none()

    row = _rows(db, where)
    if not row:
        raise not_found("Ticket not found.")
    ticket = row[0][0]
    if updated is not None:
        return _attendee(*row[0])

    # Nothing was updated: explain why, most specific reason first.
    if ticket.concert_id != concert_id:
        concert = db.get(Concert, ticket.concert_id)
        raise bad_request(
            "wrong_concert",
            f"This ticket is for another concert ({concert.title}).",
            ticket_concert_id=ticket.concert_id,
        )
    if ticket.status == "used":
        raise conflict(
            "ticket_already_used",
            "This ticket was already checked in.",
            checked_in_at=ticket.checked_in_at.isoformat(),
        )
    raise bad_request("ticket_not_valid", f"This ticket is {ticket.status} and cannot be used.", ticket_status=ticket.status)

