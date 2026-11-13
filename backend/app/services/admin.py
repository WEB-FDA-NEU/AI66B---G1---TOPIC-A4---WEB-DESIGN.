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
* ``checkinsToday`` (dashboard card, #38): tickets checked in since midnight, database
  time zone.

``concert_stats`` applies the same rules per concert; ``capacity`` is the sum of the
concert's tier capacities.
"""
from __future__ import annotations

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session

from app.errors import conflict, not_found
from app.models import Concert, Order, Reservation, Seat, Ticket, User, Zone
from app.schemas import AdminConcertInput
from app.services.orders import order_detail, order_summary
from app.services.txn import transactional

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
        "checkinsToday": db.execute(
            select(func.count())
            .select_from(Ticket)
            .where(Ticket.status == "used", Ticket.checked_in_at >= func.date_trunc("day", now))
        ).scalar_one(),
    }


def concert_stats(db: Session) -> list[dict]:
    """Every concert with capacity, tickets sold and revenue, soonest first."""
    capacity = (
        select(Zone.concert_id, func.sum(Zone.capacity).label("capacity"))
        .group_by(Zone.concert_id)
        .subquery()
    )
    sold = (
        select(Ticket.concert_id, func.count().label("sold"))
        .where(Ticket.status.in_(("valid", "used")))
        .group_by(Ticket.concert_id)
        .subquery()
    )
    checked_in = (
        select(Ticket.concert_id, func.count().label("checked_in"))
        .where(Ticket.status == "used")
        .group_by(Ticket.concert_id)
        .subquery()
    )
    revenue = (
        select(Order.concert_id, func.sum(Order.total_amount - Order.refund_amount).label("revenue"))
        .where(Order.payment_status == "paid")
        .group_by(Order.concert_id)
        .subquery()
    )
    rows = db.execute(
        select(
            Concert,
            func.coalesce(capacity.c.capacity, 0),
            func.coalesce(sold.c.sold, 0),
            func.coalesce(checked_in.c.checked_in, 0),
            func.coalesce(revenue.c.revenue, 0),
            Concert.starts_at > func.now(),
        )
        .outerjoin(capacity, capacity.c.concert_id == Concert.id)
        .outerjoin(sold, sold.c.concert_id == Concert.id)
        .outerjoin(checked_in, checked_in.c.concert_id == Concert.id)
        .outerjoin(revenue, revenue.c.concert_id == Concert.id)
        .order_by(Concert.starts_at, Concert.id)
    ).all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "artist": c.artist,
            "venue": c.venue,
            "city": c.city,
            "poster_url": c.poster_url,
            "starts_at": c.starts_at,
            "status": c.status,
            "upcoming": bool(future) and c.status in UPCOMING_STATUSES,
            "capacity": int(cap),
            "ticketsSold": int(n_sold),
            "checkedIn": int(n_in),
            "revenue": int(rev),
        }
        for c, cap, n_sold, n_in, rev, future in rows
    ]


def _concert_detail(db: Session, concert: Concert) -> dict:
    return {
        "id": concert.id,
        "title": concert.title,
        "artist": concert.artist,
        "description": concert.description,
        "venue": concert.venue,
        "city": concert.city,
        "poster_url": concert.poster_url,
        "starts_at": concert.starts_at,
        "status": concert.status,
        "zones": [
            {
                "id": zone.id,
                "name": zone.name,
                "price": int(zone.price),
                "capacity": zone.capacity,
                "color": zone.color,
            }
            for zone in db.execute(
                select(Zone).where(Zone.concert_id == concert.id).order_by(Zone.id)
            ).scalars()
        ],
    }


def list_concerts(db: Session) -> list[dict]:
    concerts = db.execute(select(Concert).order_by(Concert.starts_at, Concert.id)).scalars()
    return [_concert_detail(db, concert) for concert in concerts]


def get_concert(db: Session, concert_id: int) -> dict:
    concert = db.get(Concert, concert_id)
    if concert is None:
        raise not_found("Concert not found.")
    return _concert_detail(db, concert)


def _row_label(index: int) -> str:
    label = ""
    index += 1
    while index:
        index, remainder = divmod(index - 1, 26)
        label = chr(65 + remainder) + label
    return label


def _seat_labels(capacity: int) -> list[tuple[str, int]]:
    return [(_row_label(index // 10), index % 10 + 1) for index in range(capacity)]


def _resize_zone_seats(db: Session, zone: Zone, capacity: int) -> None:
    seats = list(
        db.execute(
            select(Seat)
            .where(Seat.zone_id == zone.id)
            .order_by(Seat.row_label, Seat.seat_number)
            .with_for_update()
        ).scalars()
    )
    if len(seats) > capacity:
        removable = list(
            db.execute(
                select(Seat)
                .where(
                    Seat.zone_id == zone.id,
                    Seat.status == "available",
                    ~select(Ticket.id).where(Ticket.seat_id == Seat.id).exists(),
                )
                .order_by(Seat.row_label.desc(), Seat.seat_number.desc())
                .limit(len(seats) - capacity)
                .with_for_update()
            ).scalars()
        )
        if len(removable) != len(seats) - capacity:
            raise conflict(
                "capacity_below_occupied",
                f"Ticket type {zone.name} has seats that cannot be removed.",
            )
        for seat in removable:
            db.delete(seat)
        seats = [seat for seat in seats if seat not in removable]

    if len(seats) < capacity:
        existing = {(seat.row_label, seat.seat_number) for seat in seats}
        additions = [
            Seat(zone_id=zone.id, row_label=row, seat_number=number)
            for row, number in _seat_labels(capacity)
            if (row, number) not in existing
        ][: capacity - len(seats)]
        if len(additions) != capacity - len(seats):
            raise conflict("capacity_update_failed", "Unable to create the requested seat inventory.")
        db.add_all(additions)
    zone.capacity = capacity


def _update_concert_fields(concert: Concert, body: AdminConcertInput) -> None:
    for field in ("title", "artist", "description", "venue", "city", "poster_url", "starts_at", "status"):
        setattr(concert, field, getattr(body, field))


@transactional
def create_concert(db: Session, body: AdminConcertInput) -> dict:
    concert = Concert(
        title=body.title,
        artist=body.artist,
        description=body.description,
        venue=body.venue,
        city=body.city,
        poster_url=body.poster_url,
        starts_at=body.starts_at,
        status=body.status,
    )
    db.add(concert)
    db.flush()
    for item in body.zones:
        zone = Zone(
            concert_id=concert.id,
            name=item.name,
            price=item.price,
            capacity=item.capacity,
            color=item.color,
        )
        db.add(zone)
        db.flush()
        db.add_all(
            Seat(zone_id=zone.id, row_label=row, seat_number=number)
            for row, number in _seat_labels(item.capacity)
        )
    db.flush()
    return _concert_detail(db, concert)


@transactional
def update_concert(db: Session, concert_id: int, body: AdminConcertInput) -> dict:
    concert = db.execute(
        select(Concert).where(Concert.id == concert_id).with_for_update()
    ).scalar_one_or_none()
    if concert is None:
        raise not_found("Concert not found.")

    existing_zones = {
        zone.id: zone
        for zone in db.execute(
            select(Zone).where(Zone.concert_id == concert_id).with_for_update()
        ).scalars()
    }
    retained_ids = {item.id for item in body.zones if item.id is not None}
    if not retained_ids.issubset(existing_zones):
        raise conflict("invalid_ticket_type", "A ticket type does not belong to this concert.")

    for zone_id, zone in existing_zones.items():
        if zone_id in retained_ids:
            continue
        has_tickets = db.execute(
            select(Ticket.id)
            .join(Seat, Seat.id == Ticket.seat_id)
            .where(Seat.zone_id == zone_id)
            .limit(1)
        ).first()
        has_occupied_seats = db.execute(
            select(Seat.id)
            .where(Seat.zone_id == zone_id, (Seat.status != "available") | Seat.reservation_id.is_not(None))
            .limit(1)
        ).first()
        if has_tickets or has_occupied_seats:
            raise conflict(
                "ticket_type_has_bookings",
                f"Ticket type {zone.name} cannot be removed while it has bookings or active holds.",
            )
        db.delete(zone)

    for item in body.zones:
        zone = existing_zones.get(item.id) if item.id is not None else None
        if zone is None:
            zone = Zone(
                concert_id=concert_id,
                name=item.name,
                price=item.price,
                capacity=item.capacity,
                color=item.color,
            )
            db.add(zone)
            db.flush()
            db.add_all(
                Seat(zone_id=zone.id, row_label=row, seat_number=number)
                for row, number in _seat_labels(item.capacity)
            )
        else:
            zone.name = item.name
            zone.price = item.price
            zone.color = item.color
            _resize_zone_seats(db, zone, item.capacity)

    _update_concert_fields(concert, body)
    db.flush()
    return _concert_detail(db, concert)


@transactional
def delete_concert(db: Session, concert_id: int) -> None:
    concert = db.execute(
        select(Concert).where(Concert.id == concert_id).with_for_update()
    ).scalar_one_or_none()
    if concert is None:
        raise not_found("Concert not found.")
    has_orders = db.execute(select(Order.id).where(Order.concert_id == concert_id).limit(1)).first()
    has_reservations = db.execute(
        select(Reservation.id).where(Reservation.concert_id == concert_id).limit(1)
    ).first()
    if has_orders or has_reservations:
        raise conflict(
            "concert_has_bookings",
            "Concerts with orders or reservations cannot be deleted. Cancel the concert instead.",
        )
    db.delete(concert)


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
