"""Read-only seat availability for the seat-selection screen."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found
from app.models import Concert, Reservation, Seat, Zone
from app.services.reservations import db_now


def seat_map(db: Session, concert_id: int, user_id: int | None = None) -> dict:
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise not_found("Concert not found.")
    now = db_now(db)
    zones = db.execute(select(Zone).where(Zone.concert_id == concert_id).order_by(Zone.id)).scalars().all()
    rows = db.execute(
        select(Seat, Reservation.user_id)
        .outerjoin(Reservation, Reservation.id == Seat.reservation_id)
        .where(Seat.zone_id.in_([z.id for z in zones]))
        .order_by(Seat.zone_id, Seat.row_label, Seat.seat_number)
    ).all()
    by_zone: dict[int, list[dict]] = {z.id: [] for z in zones}
    for seat, holder_id in rows:
        status = seat.status
        mine = False
        if status == "held":
            if seat.held_until <= now:
                status = "available"  # lapsed hold: free even before the sweeper runs
            else:
                mine = user_id is not None and holder_id == user_id
        by_zone[seat.zone_id].append(
            {"id": seat.id, "row": seat.row_label, "number": seat.seat_number, "status": status, "held_by_me": mine}
        )
    return {
        "concert_id": concert.id,
        "status": concert.status,
        "zones": [
            {
                "id": z.id,
                "name": z.name,
                "price": int(z.price),
                "color": z.color,
                "booking_type": z.booking_type,
                "available": sum(1 for s in by_zone[z.id] if s["status"] == "available"),
                "held": sum(1 for s in by_zone[z.id] if s["status"] == "held"),
                "sold": sum(1 for s in by_zone[z.id] if s["status"] == "sold"),
                "held_by_me_count": sum(1 for s in by_zone[z.id] if s["held_by_me"]),
                # Standing inventory has no public row/seat assignments.
                "seats": by_zone[z.id] if z.booking_type == "seated" else [],
            }
            for z in zones
        ],
    }
