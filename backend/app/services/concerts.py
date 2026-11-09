"""Public concert listing and detail service (task #48)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.errors import not_found
from app.models import Concert, Seat, Ticket, Zone

SEED_FILE = Path(__file__).resolve().parents[2] / "scripts" / "seed_data.json"


def _load_seed_meta() -> dict[int, dict]:
    if not SEED_FILE.exists():
        return {}
    try:
        raw = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        return {int(c["id"]): c for c in raw.get("concerts", []) if "id" in c}
    except Exception:
        return {}


SEED_META = _load_seed_meta()


def _parse_concert_id(raw_id: str | int) -> int:
    if isinstance(raw_id, int):
        return raw_id
    s = str(raw_id).strip().lower()
    if s.startswith("c") and s[1:].isdigit():
        return int(s[1:])
    if s.isdigit():
        return int(s)
    raise not_found("Concert not found.")


def _display_badge(concert: Concert, capacity: int, available_seats: int, meta: dict) -> str:
    if concert.status == "cancelled":
        return "Cancelled"
    if concert.status == "sold_out" or (capacity > 0 and available_seats == 0):
        return "Sold Out"
    if concert.status == "completed":
        return "Ended"
    if concert.status == "draft":
        return "Draft"
    if capacity > 0 and available_seats / capacity <= 0.25:
        return "Limited Availability"
    if meta.get("id") in (2, 5, 7, 9):
        return "Most Popular"
    return "Selling Fast"


def serialize_concert(db: Session, concert: Concert) -> dict:
    zones = list(
        db.execute(select(Zone).where(Zone.concert_id == concert.id).order_by(Zone.price, Zone.id)).scalars()
    )
    seat_counts = dict(
        db.execute(
            select(Seat.zone_id, func.count())
            .where(Seat.zone_id.in_([z.id for z in zones]), Seat.status == "available")
            .group_by(Seat.zone_id)
        ).all()
    ) if zones else {}

    sold_counts = dict(
        db.execute(
            select(Seat.zone_id, func.count())
            .where(Seat.zone_id.in_([z.id for z in zones]), Seat.status != "available")
            .group_by(Seat.zone_id)
        ).all()
    ) if zones else {}

    tickets_sold = db.execute(
        select(func.count())
        .select_from(Ticket)
        .where(Ticket.concert_id == concert.id, Ticket.status.in_(("valid", "used")))
    ).scalar_one()

    total_capacity = sum(z.capacity for z in zones)
    total_available = sum(seat_counts.get(z.id, 0) for z in zones)

    prices = [int(z.price) for z in zones]
    if prices:
        min_p, max_p = min(prices), max(prices)
        price_range = f"${min_p} - ${max_p}" if min_p != max_p else f"${min_p}"
    else:
        min_p, max_p = 0, 0
        price_range = "From $0"

    meta = SEED_META.get(concert.id, {})
    starts_iso = concert.starts_at.isoformat()
    date_str = concert.starts_at.strftime("%Y-%m-%d")
    time_str = concert.starts_at.strftime("%H:%M")
    location = f"{concert.venue}, {concert.city}" if concert.city and concert.city not in concert.venue else concert.venue

    poster = concert.poster_url or meta.get("poster") or ""
    if "acfc.com.vn" in poster:
        poster = "https://images.unsplash.com/photo-1540039155732-d692a15306eb?auto=format&fit=crop&w=1200&q=80"
    banner = meta.get("banner") or poster
    if "acfc.com.vn" in banner:
        banner = poster

    category = meta.get("category") or "Pop"
    badge_status = _display_badge(concert, total_capacity, total_available, meta)

    zone_list = []
    ticket_list = []
    for z in zones:
        avail = seat_counts.get(z.id, 0)
        sold = sold_counts.get(z.id, 0)
        if avail == 0:
            t_status = "Sold Out"
        elif avail <= max(5, int(z.capacity * 0.2)):
            t_status = "Limited"
        else:
            t_status = "Available"

        zone_list.append(
            {
                "id": z.id,
                "name": z.name,
                "price": int(z.price),
                "capacity": z.capacity,
                "available": avail,
                "sold": sold,
                "color": z.color,
                "status": t_status,
            }
        )
        ticket_list.append(
            {
                "id": z.id,
                "type": z.name,
                "price": f"${int(z.price)}",
                "priceValue": int(z.price),
                "capacity": z.capacity,
                "available": avail,
                "sold": sold,
                "status": t_status,
            }
        )

    return {
        "id": f"c{concert.id}",
        "concert_id": concert.id,
        "slug": f"c{concert.id}",
        "title": concert.title,
        "artist": concert.artist,
        "description": concert.description or "",
        "venue": concert.venue,
        "city": concert.city,
        "location": location,
        "starts_at": starts_iso,
        "date": date_str,
        "time": time_str,
        "poster_url": poster,
        "poster": poster,
        "banner": banner,
        "category": category,
        "db_status": concert.status,
        "status": badge_status,
        "priceRange": price_range,
        "min_price": min_p,
        "max_price": max_p,
        "ticketsSold": int(tickets_sold),
        "ticketCapacity": total_capacity,
        "zones": zone_list,
        "tickets": ticket_list,
    }


def list_concerts(
    db: Session,
    *,
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = None,
    page: int = 1,
    size: int = 50,
    include_all_statuses: bool = False,
) -> dict:
    stmt = select(Concert)
    if not include_all_statuses:
        stmt = stmt.where(Concert.status.in_(("on_sale", "sold_out", "completed", "draft", "cancelled")))

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Concert.title.ilike(term),
                Concert.artist.ilike(term),
                Concert.venue.ilike(term),
                Concert.city.ilike(term),
            )
        )

    stmt = stmt.order_by(Concert.starts_at.asc(), Concert.id.asc())
    concerts = list(db.execute(stmt).scalars())
    items = [serialize_concert(db, c) for c in concerts]

    if category and category.lower() != "all":
        items = [i for i in items if i["category"].lower() == category.lower()]

    if status and status.lower() != "all":
        st = status.lower()
        items = [
            i
            for i in items
            if st in i["status"].lower()
            or st == i["db_status"].lower()
            or (st == "popular" and "popular" in i["status"].lower())
            or (st == "selling-fast" and "selling" in i["status"].lower())
            or (st == "limited" and "limited" in i["status"].lower())
        ]

    if sort_by in ("price", "price-low"):
        items.sort(key=lambda x: x["min_price"])
    elif sort_by == "price-high":
        items.sort(key=lambda x: x["min_price"], reverse=True)
    elif sort_by == "date":
        items.sort(key=lambda x: x["starts_at"])

    total = len(items)
    pages = max(1, (total + size - 1) // size)
    start = (page - 1) * size
    paged_items = items[start : start + size]

    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages,
    }


def get_concert(db: Session, concert_ref: str | int) -> dict:
    cid = _parse_concert_id(concert_ref)
    concert = db.get(Concert, cid)
    if concert is None:
        raise not_found("Concert not found.")
    return serialize_concert(db, concert)
