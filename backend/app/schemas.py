from __future__ import annotations

import re
from datetime import datetime
from typing import Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, StrictInt, StrictStr, field_validator, model_validator

from app.config import MAX_SEATS_PER_RESERVATION


class StandingSelection(BaseModel):
    zone_id: int = Field(ge=1)
    quantity: StrictInt = Field(ge=1, le=MAX_SEATS_PER_RESERVATION)


class HoldRequest(BaseModel):
    concert_id: int
    seat_ids: list[int] = Field(default_factory=list, max_length=MAX_SEATS_PER_RESERVATION)
    standing: list[StandingSelection] = Field(default_factory=list, max_length=MAX_SEATS_PER_RESERVATION)

    @model_validator(mode="after")
    def total_tickets(self):
        count = len(self.seat_ids) + sum(s.quantity for s in self.standing)
        if not 1 <= count <= MAX_SEATS_PER_RESERVATION:
            raise ValueError(f"Select 1–{MAX_SEATS_PER_RESERVATION} tickets in total.")
        if len({s.zone_id for s in self.standing}) != len(self.standing):
            raise ValueError("Standing zones must not be repeated.")
        return self


class BuyerInformation(BaseModel):
    """Validate checkout contact input without changing stored account/order data."""
    full_name: str = Field(min_length=2, max_length=150)
    email: str = Field(max_length=255)
    phone: str = Field(max_length=30)

    @field_validator("full_name", "email", "phone", mode="before")
    @classmethod
    def strip_contact(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value):
        if not re.fullmatch(r"\+?[0-9 ()-]+", value) or not 8 <= len(re.sub(r"\D", "", value)) <= 15:
            raise ValueError("Phone numbers must contain 8–15 digits.")
        return value


class CheckoutRequest(BaseModel):
    reservation_id: UUID
    payment_method: str
    # Required at the HTTP boundary; this does not change stored account/order data.
    buyer: BuyerInformation


class CancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class CheckInRequest(BaseModel):
    ticket_code: str = Field(min_length=1, max_length=64)


# Money columns are whole-unit NUMERIC(12,0); they are declared int so JSON carries plain numbers.
class SeatOut(BaseModel):
    id: int
    zone_id: int
    zone_name: str
    row_label: Optional[str]
    seat_number: Optional[int]
    price: int
    booking_type: str = "seated"


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
    poster_url: Optional[str] = None
    zone: str
    row: Optional[str]
    seat_number: Optional[int]
    booking_type: str = "seated"
    price: int
    status: str
    checked_in_at: Optional[datetime] = None
    qr_data: Optional[str] = None


class TicketDetailOut(TicketOut):
    holder_name: str
    qr_image: Optional[str] = None  # SVG data URI of qr_data; null unless the ticket is valid


class OrderSummaryOut(BaseModel):
    id: int
    order_number: int
    concert_id: int
    concert_title: str
    artist: str
    venue: str
    city: str
    poster_url: Optional[str] = None
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
    checkinsToday: int


class AdminConcertStatsOut(BaseModel):
    id: int
    title: str
    artist: str
    venue: str
    city: str
    poster_url: Optional[str] = None
    starts_at: datetime
    status: str
    upcoming: bool
    capacity: int
    ticketsSold: int
    checkedIn: int
    revenue: int
    availableInventory: int
    heldInventory: int
    soldInventory: int


class AdminConcertZoneInput(BaseModel):
    # Omitted/null preserves existing type on edit; new zones default to seated.
    booking_type: Optional[Literal["seated", "standing"]] = None
    id: Optional[int] = Field(default=None, ge=1)
    name: str = Field(min_length=1, max_length=100)
    price: int = Field(ge=0, le=999_999_999_999)
    capacity: int = Field(ge=1, le=50_000)
    color: Optional[str] = Field(default=None, max_length=20)

    @field_validator("name")
    @classmethod
    def _trim_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Zone name cannot be blank.")
        return value


class AdminConcertInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    artist: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=10_000)
    venue: str = Field(min_length=1, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    poster_url: Optional[str] = Field(default=None, max_length=2048)
    starts_at: datetime
    status: Literal["draft", "on_sale", "sold_out", "cancelled", "completed"]
    zones: list[AdminConcertZoneInput] = Field(min_length=1, max_length=50)

    @field_validator("title", "artist", "venue", "city")
    @classmethod
    def _trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("starts_at")
    @classmethod
    def _require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Concert start time must include a timezone.")
        return value

    @field_validator("zones")
    @classmethod
    def _unique_zone_names(cls, value: list[AdminConcertZoneInput]) -> list[AdminConcertZoneInput]:
        names = [zone.name.casefold() for zone in value]
        if len(names) != len(set(names)):
            raise ValueError("Ticket type names must be unique.")
        ids = [zone.id for zone in value if zone.id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("A ticket type can only be included once.")
        if sum(zone.capacity for zone in value) > 20_000:
            raise ValueError("Total concert capacity cannot exceed 20,000 seats.")
        return value


class AdminConcertZoneOut(BaseModel):
    booking_type: Literal["seated", "standing"]
    id: int
    name: str
    price: int
    capacity: int
    color: Optional[str] = None


class AdminConcertOut(BaseModel):
    id: int
    title: str
    artist: str
    description: Optional[str] = None
    venue: str
    city: str
    poster_url: Optional[str] = None
    starts_at: datetime
    status: str
    zones: list[AdminConcertZoneOut]


class PublicConcertCatalogOut(BaseModel):
    items: list[AdminConcertOut]
    managed_ids: list[int]


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
    row: Optional[str]
    seat_number: Optional[int]
    booking_type: str = "seated"
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


# ------------------------------------------------------------------- auth (login)

class AuthUserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserOut


class AdminZoneUpdateInput(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    price: Optional[int] = Field(default=None, ge=0, le=999_999_999_999)
    capacity: Optional[int] = Field(default=None, ge=1, le=20_000)
    color: Optional[str] = Field(default=None, max_length=20)
    booking_type: Optional[Literal["seated", "standing"]] = None

    @field_validator("name")
    @classmethod
    def _trim_zone_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Zone name cannot be blank.")
        return value
