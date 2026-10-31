from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HoldRequest(BaseModel):
    concert_id: int
    seat_ids: list[int] = Field(min_length=1, max_length=8)


class CheckoutRequest(BaseModel):
    reservation_id: UUID
    payment_method: str


class CancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class CheckInRequest(BaseModel):
    ticket_code: str = Field(min_length=1, max_length=64)


# Money columns are whole-unit NUMERIC(12,0); they are declared int so JSON carries plain numbers.
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


class TicketOut(BaseModel):
    id: int
    ticket_code: str
    order_id: int
    order_number: Optional[int] = None
    concert_id: int
    concert_title: str
    artist: str
    venue: str
    city: str
    starts_at: datetime
    zone: str
    row: str
    seat_number: int
    price: int
    status: str
    checked_in_at: Optional[datetime] = None


class OrderSummaryOut(BaseModel):
    id: int
    order_number: int
    concert_id: int
    concert_title: str
    starts_at: datetime
    total_amount: int
    status: str
    payment_method: Optional[str] = None
    payment_status: str
    refund_status: str
    ticket_count: int
    created_at: datetime


class OrderDetailOut(OrderSummaryOut):
    reservation_id: Optional[UUID] = None
    payment_ref: Optional[str] = None
    paid_at: Optional[datetime] = None
    refund_amount: int
    refund_reason: Optional[str] = None
    refunded_at: Optional[datetime] = None
    can_cancel: bool
    tickets: list[TicketOut]
