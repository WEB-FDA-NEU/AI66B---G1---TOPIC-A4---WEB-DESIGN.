"""Admin-only endpoints. Every route depends on require_admin: 401 without a valid
token, 403 for any role other than admin."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.schemas import AdminOrderDetailOut, AdminOrderPageOut, AdminStatsOut
from app.services import admin as svc

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db)):
    return svc.stats(db)


@router.get("/orders", response_model=AdminOrderPageOut)
def list_orders(
    status: Optional[str] = Query(default=None, pattern="^(pending|paid|cancelled|failed|refunded)$"),
    concert_id: Optional[int] = Query(default=None, ge=1),
    q: Optional[str] = Query(default=None, max_length=100, description="Order number, customer or concert"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return svc.list_orders(db, status=status, concert_id=concert_id, q=q, page=page, page_size=page_size)


@router.get("/orders/{order_id}", response_model=AdminOrderDetailOut)
def order_detail(order_id: int, db: Session = Depends(get_db)):
    return svc.get_order(db, order_id)
