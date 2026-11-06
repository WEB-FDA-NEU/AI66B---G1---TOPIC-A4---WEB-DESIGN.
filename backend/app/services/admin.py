"""Admin dashboard statistics and order management (issue #35).

Business rules
--------------
* ``totalRevenue``: money actually kept = ``total_amount - refund_amount`` summed over
  orders whose payment succeeded and was not refunded (``payment_status = 'paid'``).
  Pending, failed and cancelled/refunded orders contribute nothing (the existing
  dashboard only counted "Paid" orders; refunds are full, see orders.cancel_order).
* ``ticketsSold``: issued tickets that still grant entry (``valid`` or ``used``).
  Cancelled/refunded tickets are not counted.
* ``totalOrders``: every order row, whatever its status.
* ``totalConcerts``: every concert in the catalogue.
* ``upcomingConcerts``: concerts that have not started yet and are published for sale
  (``on_sale`` or ``sold_out``); drafts, cancelled and completed shows are excluded.
"""
from __future__ import annotations

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.errors import not_found
from app.models import Concert, Order, Ticket, User
from app.services.orders import order_detail, order_summary

ORDER_STATUS_FILTERS = ("pending", "paid", "cancelled", "failed", "refunded")
UPCOMING_STATUSES = ("on_sale", "sold_out")


def stats(db: Session) -> dict:
    now = func.now()
    revenue = db.execute(
        select(func.coalesce(func.sum(Order.total_amount - Order.refund_amount), 0)).where(
            Order.payment_status == "paid"
        )
    ).scalar_one()
    return {
        "totalConcerts": db.execute(select(func.count()).select_from(Concert)).scalar_one(),
        "ticketsSold": db.execute(
            select(func.count()).select_from(Ticket).where(Ticket.status.in_(("valid", "used")))
        ).scalar_one(),
        "totalOrders": db.execute(select(func.count()).select_from(Order)).scalar_one(),
        "totalRevenue": int(revenue),
        "upcomingConcerts": db.execute(
            select(func.count())
            .select_from(Concert)
            .where(Concert.starts_at > now, Concert.status.in_(UPCOMING_STATUSES))
        ).scalar_one(),
    }


def _customer(user: User, *, with_phone: bool = False) -> dict:
    data = {"id": user.id, "email": user.email, "full_name": user.full_name}
    if with_phone:
        data["phone"] = user.phone
    return data


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_orders(
    db: Session,
    *,
    status: str | None = None,
    concert_id: int | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    filters = []
    if status == "refunded":
        filters.append(Order.payment_status == "refunded")
    elif status:
        filters.append(Order.status == status)
    if concert_id is not None:
        filters.append(Order.concert_id == concert_id)
    term = (q or "").strip().lstrip("#").strip()
    if term:
        pattern = f"%{_escape_like(term)}%"
        filters.append(
            or_(
                cast(Order.order_number, String).ilike(pattern, escape="\\"),
                User.email.ilike(pattern, escape="\\"),
                User.full_name.ilike(pattern, escape="\\"),
                Concert.title.ilike(pattern, escape="\\"),
                Concert.artist.ilike(pattern, escape="\\"),
            )
        )

    base = (
        select(Order.id)
        .join(User, User.id == Order.user_id)
        .join(Concert, Concert.id == Order.concert_id)
        .where(*filters)
    )
    total = db.execute(select(func.count()).select_from(base.subquery())).scalar_one()

    ticket_counts = select(Ticket.order_id, func.count().label("n")).group_by(Ticket.order_id).subquery()
    rows = db.execute(
        select(Order, Concert, User, func.coalesce(ticket_counts.c.n, 0))
        .join(User, User.id == Order.user_id)
        .join(Concert, Concert.id == Order.concert_id)
        .outerjoin(ticket_counts, ticket_counts.c.order_id == Order.id)
        .where(*filters)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()

    items = []
    for order, concert, user, n in rows:
        item = order_summary(order, concert, n)
        item["customer"] = _customer(user)
        items.append(item)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


def get_order(db: Session, order_id: int) -> dict:
    order = db.get(Order, order_id)
    if order is None:
        raise not_found("Order not found.")
    data = order_detail(db, order)
    data["customer"] = _customer(db.get(User, order.user_id), with_phone=True)
    return data
