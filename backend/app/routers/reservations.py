from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.schemas import HoldRequest, ReservationOut
from app.services import reservations as svc

router = APIRouter(prefix="/reservations", tags=["reservations"])


def _out(view: svc.ReservationView) -> ReservationOut:
    left = max(0, int((view.expires_at - datetime.now(timezone.utc)).total_seconds()))
    return ReservationOut(
        id=view.id,
        concert_id=view.concert_id,
        status=view.status,
        expires_at=view.expires_at,
        seconds_left=left if view.status == "active" else 0,
        total_amount=int(view.total_amount),
        seats=[
            {
                "id": s.id,
                "zone_id": s.zone_id,
                "zone_name": s.zone_name,
                "row_label": s.row_label,
                "seat_number": s.seat_number,
                "price": int(s.price),
                "booking_type": s.booking_type,
            }
            for s in view.seats
        ],
    )


@router.post("", response_model=ReservationOut, status_code=201)
def create_reservation(body: HoldRequest, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _out(svc.hold_tickets(db, user.id, body.concert_id, body.seat_ids, [(s.zone_id, s.quantity) for s in body.standing]))


@router.get("/{reservation_id}", response_model=ReservationOut)
def read_reservation(reservation_id: UUID, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _out(svc.get_reservation(db, reservation_id, user.id))


@router.delete("/{reservation_id}", response_model=ReservationOut)
def release_reservation(reservation_id: UUID, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _out(svc.release_reservation(db, reservation_id, user.id))
