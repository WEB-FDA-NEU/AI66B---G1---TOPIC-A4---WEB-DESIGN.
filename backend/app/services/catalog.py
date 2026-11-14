"""Public concert catalogue, including the IDs of admin-managed concerts (task #48)."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.errors import not_found
from app.models import Concert
from app.services.admin import _concert_detail

PUBLIC_STATUSES = ("on_sale", "sold_out")


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_concerts(
    db: Session,
    *,
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort: Optional[str] = None,
) -> dict:
    managed_ids = list(db.execute(select(Concert.id).order_by(Concert.id)).scalars())
    stmt = select(Concert).where(Concert.status.in_(PUBLIC_STATUSES))

    if search and search.strip():
        pattern = f"%{_escape_like(search.strip())}%"
        stmt = stmt.where(
            or_(
                Concert.title.ilike(pattern, escape="\\"),
                Concert.artist.ilike(pattern, escape="\\"),
                Concert.venue.ilike(pattern, escape="\\"),
                Concert.city.ilike(pattern, escape="\\"),
            )
        )

    if status:
        stmt = stmt.where(Concert.status == status)

    concerts = db.execute(stmt.order_by(Concert.starts_at, Concert.id)).scalars()
    items = [_concert_detail(db, concert) for concert in concerts]

    if sort == "price-low":
        items.sort(key=lambda c: (min((z["price"] for z in c["zones"]), default=0), c["starts_at"], c["id"]))
    elif sort == "price-high":
        items.sort(key=lambda c: (-max((z["price"] for z in c["zones"]), default=0), c["starts_at"], c["id"]))

    return {
        "items": items,
        "managed_ids": managed_ids,
    }


def get_concert(db: Session, concert_id: int) -> dict:
    concert = db.get(Concert, concert_id)
    if concert is None or concert.status not in PUBLIC_STATUSES:
        raise not_found("Concert not found.")
    return _concert_detail(db, concert)
