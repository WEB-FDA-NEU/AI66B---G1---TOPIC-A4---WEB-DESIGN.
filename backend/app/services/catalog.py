"""Public concert catalogue, including the IDs of admin-managed concerts."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found
from app.models import Concert
from app.services.admin import _concert_detail

PUBLIC_STATUSES = ("on_sale", "sold_out")


def list_concerts(db: Session) -> dict:
    managed_ids = list(db.execute(select(Concert.id).order_by(Concert.id)).scalars())
    concerts = db.execute(
        select(Concert)
        .where(Concert.status.in_(PUBLIC_STATUSES))
        .order_by(Concert.starts_at, Concert.id)
    ).scalars()
    return {
        "items": [_concert_detail(db, concert) for concert in concerts],
        "managed_ids": managed_ids,
    }


def get_concert(db: Session, concert_id: int) -> dict:
    concert = db.get(Concert, concert_id)
    if concert is None or concert.status not in PUBLIC_STATUSES:
        raise not_found("Concert not found.")
    return _concert_detail(db, concert)
