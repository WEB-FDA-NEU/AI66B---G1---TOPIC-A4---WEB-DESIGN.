from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HoldRequest(BaseModel):
    concert_id: int
    seat_ids: list[int] = Field(min_length=1, max_length=8)


class SeatOut(BaseModel):
    id: int
    zone_id: int
    zone_name: str
    row_label: str
    seat_number: int
    price: int


class ReservationOut(BaseModel):
    id: UUID
    concert_id: int
    status: str
    expires_at: datetime
    seconds_left: int
    total_amount: int
    seats: list[SeatOut]
