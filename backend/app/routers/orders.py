from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.schemas import (
    CancelRequest,
    CheckInRequest,
    CheckoutRequest,
    OrderDetailOut,
    OrderSummaryOut,
    TicketOut,
)
from app.services import checkout as checkout_svc
from app.services import orders as svc

router = APIRouter(tags=["orders"])


@router.post("/checkout", response_model=OrderDetailOut, status_code=201)
def checkout(body: CheckoutRequest, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return checkout_svc.checkout(db, user.id, body.reservation_id, body.payment_method)


@router.get("/orders", response_model=list[OrderSummaryOut])
def my_orders(
    status: Optional[str] = Query(default=None, pattern="^(pending|paid|cancelled|failed)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return svc.list_orders(db, user.id, status, limit, offset)


@router.get("/orders/{order_id}", response_model=OrderDetailOut)
def order_detail(order_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return svc.get_order(db, user.id, order_id, user.role)


@router.post("/orders/{order_id}/cancel", response_model=OrderDetailOut)
def cancel_order(
    order_id: int,
    body: Optional[CancelRequest] = None,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return svc.cancel_order(db, user.id, order_id, body.reason if body else None)


@router.get("/tickets", response_model=list[TicketOut])
def my_tickets(
    status: Optional[str] = Query(default=None, pattern="^(valid|used|cancelled|refunded)$"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    return svc.list_tickets(db, user.id, status)


# Declared before /tickets/{ticket_id} so "check-in" is never parsed as an id.
@router.post("/tickets/check-in", response_model=TicketOut)
def check_in(body: CheckInRequest, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    svc.require_staff(user.role)
    return svc.check_in_ticket(db, user.id, body.ticket_code)


@router.get("/tickets/{ticket_id}", response_model=TicketOut)
def ticket_detail(ticket_id: int, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return svc.get_ticket(db, user.id, ticket_id, user.role)
