from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_optional_user_id
from app.schemas import AdminConcertOut, PublicConcertCatalogOut
from app.services import catalog
from app.services.seatmap import seat_map

router = APIRouter(tags=["seats"])


@router.get("/concerts", response_model=PublicConcertCatalogOut)
def list_concerts(db: Session = Depends(get_db)):
    return catalog.list_concerts(db)


@router.get("/concerts/{concert_id}", response_model=AdminConcertOut)
def get_concert(concert_id: int, db: Session = Depends(get_db)):
    return catalog.get_concert(db, concert_id)


@router.get("/concerts/{concert_id}/seats")
def get_seats(
    concert_id: int,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    return seat_map(db, concert_id, user_id)
