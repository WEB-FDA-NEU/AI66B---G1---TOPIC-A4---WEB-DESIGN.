"""Public concert listing, detail, and database seed trigger (task #48)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import concerts as svc

router = APIRouter(prefix="/concerts", tags=["concerts"])


@router.get("")
def list_concerts(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    sort_by: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return svc.list_concerts(
        db,
        search=search,
        category=category,
        status=status,
        sort_by=sort_by,
        page=page,
        size=size,
    )


@router.get("/{concert_id}")
def get_concert(concert_id: str, db: Session = Depends(get_db)):
    return svc.get_concert(db, concert_id)


@router.post("/seed")
def seed_concerts_endpoint(db: Session = Depends(get_db)):
    from scripts.seed import load_data, seed

    data = load_data()
    created = seed(db, data, sample_orders=True)
    db.commit()
    return {"message": "Seed complete.", "created": created}
