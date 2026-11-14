"""Admin-only endpoints. Every route depends on require_admin: 401 without a valid
token, 403 for any role other than admin."""
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.deps import CurrentUser
from app.errors import DomainError
from app.schemas import (
    AdminCheckInRequest,
    AdminConcertInput,
    AdminConcertOut,
    AdminConcertZoneOut,
    AdminZoneUpdateInput,
    AdminConcertStatsOut,
    AdminOrderDetailOut,
    AdminOrderPageOut,
    AdminStatsOut,
    AttendeeListOut,
    AttendeeOut,
)
from app.services import admin as svc
from app.services import checkin as checkin_svc

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
}


@router.get("/stats", response_model=AdminStatsOut)
def stats(db: Session = Depends(get_db)):
    return svc.stats(db)


@router.get("/stats/concerts", response_model=list[AdminConcertStatsOut])
def concert_stats(db: Session = Depends(get_db)):
    return svc.concert_stats(db)


@router.get("/concerts", response_model=list[AdminConcertOut])
def list_concerts(db: Session = Depends(get_db)):
    return svc.list_concerts(db)


@router.get("/concerts/{concert_id}", response_model=AdminConcertOut)
def get_concert(concert_id: int, db: Session = Depends(get_db)):
    return svc.get_concert(db, concert_id)


@router.post("/concerts", response_model=AdminConcertOut, status_code=201)
def create_concert(body: AdminConcertInput, db: Session = Depends(get_db)):
    return svc.create_concert(db, body)


@router.post("/concerts/upload-image")
async def upload_concert_image(image: UploadFile = File(...)):
    image_type = IMAGE_TYPES.get(image.content_type or "")
    if image_type is None:
        raise DomainError(415, "unsupported_image_type", "Upload a JPG, PNG, or WebP image.")

    content = await image.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise DomainError(413, "image_too_large", "Image must be 5 MB or smaller.")
    extension, is_valid = image_type
    if not is_valid(content):
        raise DomainError(415, "invalid_image", "The uploaded file does not match its image type.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(content)
    return {"url": f"/uploads/{filename}"}


@router.put("/concerts/{concert_id}", response_model=AdminConcertOut)
def update_concert(concert_id: int, body: AdminConcertInput, db: Session = Depends(get_db)):
    return svc.update_concert(db, concert_id, body)


@router.delete("/concerts/{concert_id}", status_code=204)
def delete_concert(concert_id: int, db: Session = Depends(get_db)):
    svc.delete_concert(db, concert_id)


@router.put("/zones/{zone_id}", response_model=AdminConcertZoneOut)
def update_zone(zone_id: int, body: AdminZoneUpdateInput, db: Session = Depends(get_db)):
    return svc.update_zone(db, zone_id, body)


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


@router.get("/concerts/{concert_id}/attendees", response_model=AttendeeListOut)
def attendees(concert_id: int, db: Session = Depends(get_db)):
    return checkin_svc.attendees(db, concert_id)


@router.post("/checkin", response_model=AttendeeOut)
def check_in(body: AdminCheckInRequest, db: Session = Depends(get_db), admin: CurrentUser = Depends(require_admin)):
    return checkin_svc.check_in(db, admin.id, body.concertId, body.ticketId)
