from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.schemas import CheckoutRequest, OrderDetailOut
from app.services import checkout as checkout_svc

router = APIRouter(tags=["orders"])


@router.post("/checkout", response_model=OrderDetailOut, status_code=201)
def checkout(body: CheckoutRequest, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return checkout_svc.checkout(db, user.id, body.reservation_id, body.payment_method)
