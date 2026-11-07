from __future__ import annotations

from datetime import datetime
from typing import Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, StrictInt, StrictStr, field_validator


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


# ------------------------------------------------------------------- admin (#35)

class AdminStatsOut(BaseModel):
    totalConcerts: int
    ticketsSold: int
    totalOrders: int
    totalRevenue: int
    upcomingConcerts: int


class CustomerOut(BaseModel):
    id: int
    email: str
    full_name: str


class CustomerDetailOut(CustomerOut):
    phone: Optional[str] = None


class AdminOrderSummaryOut(OrderSummaryOut):
    customer: CustomerOut


class AdminOrderPageOut(BaseModel):
    items: list[AdminOrderSummaryOut]
    total: int
    page: int
    page_size: int
    pages: int


class AdminOrderDetailOut(OrderDetailOut):
    customer: CustomerDetailOut


# ---------------------------------------------------------------- check-in (#36)

class AdminCheckInRequest(BaseModel):
    # A ticket id (attendee table) or the ticket code read from the QR.
    ticketId: Union[StrictInt, StrictStr] = Field(description="Ticket id or ticket code (QR payload)")
    concertId: int = Field(ge=1, description="The concert whose gate is checking people in")

    @field_validator("ticketId")
    @classmethod
    def _ticket_ref(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if not value or len(value) > 64:
                raise ValueError("ticketId must be 1-64 characters")
        return value


class AttendeeOut(BaseModel):
    ticket_id: int
    ticket_code: str
    status: str
    checked_in: bool
    checked_in_at: Optional[datetime] = None
    zone: str
    row: str
    seat_number: int
    price: int
    order_id: int
    order_number: int
    customer: CustomerOut


class AttendeeConcertOut(BaseModel):
    id: int
    title: str
    venue: str
    starts_at: datetime
    status: str


class AttendeeListOut(BaseModel):
    concert: AttendeeConcertOut
    total: int
    checked_in: int
    not_checked_in: int
    items: list[AttendeeOut]
