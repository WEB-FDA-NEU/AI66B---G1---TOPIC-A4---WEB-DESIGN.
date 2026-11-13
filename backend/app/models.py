from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('customer', 'staff', 'admin')", name="ck_users_role"),
        Index("uq_users_email_lower", func.lower(text("email")), unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'customer'"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    reservations: Mapped[list[Reservation]] = relationship(back_populates="user")
    orders: Mapped[list[Order]] = relationship(back_populates="user")
    checked_in_tickets: Mapped[list[Ticket]] = relationship(
        back_populates="checked_in_user",
        foreign_keys="Ticket.checked_in_by",
    )


class Concert(Base):
    __tablename__ = "concerts"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'on_sale', 'sold_out', 'cancelled', 'completed')",
            name="ck_concerts_status",
        ),
        CheckConstraint(
            "sale_end_at IS NULL OR sale_start_at IS NULL OR sale_end_at > sale_start_at",
            name="ck_concerts_sale_window",
        ),
        CheckConstraint(
            "doors_open_at IS NULL OR doors_open_at <= starts_at",
            name="ck_concerts_doors_before_start",
        ),
        Index("ix_concerts_status_starts_at", "status", "starts_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    artist: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    venue: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    poster_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    doors_open_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sale_start_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sale_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'draft'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    zones: Mapped[list[Zone]] = relationship(back_populates="concert", cascade="all, delete-orphan")
    reservations: Mapped[list[Reservation]] = relationship(back_populates="concert")
    orders: Mapped[list[Order]] = relationship(back_populates="concert")
    tickets: Mapped[list[Ticket]] = relationship(back_populates="concert")


class Zone(Base):
    __tablename__ = "zones"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_zones_price_nonnegative"),
        CheckConstraint("booking_type IN ('seated', 'standing')", name="ck_zones_booking_type"),
        CheckConstraint("capacity > 0", name="ck_zones_capacity_positive"),
        UniqueConstraint("concert_id", "name", name="uq_zones_concert_name"),
        Index("ix_zones_concert_id", "concert_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    concert_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("concerts.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    concert: Mapped[Concert] = relationship(back_populates="zones")
    seats: Mapped[list[Seat]] = relationship(back_populates="zone", cascade="all, delete-orphan")

    booking_type: Mapped[str] = mapped_column(String(10), nullable=False, default="seated", server_default=text("'seated'"))


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'converted', 'expired', 'cancelled')",
            name="ck_reservations_status",
        ),
        CheckConstraint("expires_at > created_at", name="ck_reservations_expires_after_created"),
        Index("ix_reservations_user_status", "user_id", "status"),
        Index(
            "ix_reservations_active_expires_at",
            "expires_at",
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    concert_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("concerts.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'active'"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="reservations")
    concert: Mapped[Concert] = relationship(back_populates="reservations")
    seats: Mapped[list[Seat]] = relationship(back_populates="reservation")
    order: Mapped[Optional[Order]] = relationship(back_populates="reservation", uselist=False)


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (
        CheckConstraint("seat_number > 0", name="ck_seats_number_positive"),
        CheckConstraint("status IN ('available', 'held', 'sold')", name="ck_seats_status"),
        CheckConstraint(
            "(status <> 'held' OR (held_until IS NOT NULL AND reservation_id IS NOT NULL)) "
            "AND (status NOT IN ('available', 'sold') OR held_until IS NULL)",
            name="ck_seats_hold_fields",
        ),
        UniqueConstraint("zone_id", "row_label", "seat_number", name="uq_seats_zone_row_number"),
        Index("ix_seats_zone_status", "zone_id", "status"),
        Index("ix_seats_held_until", "held_until", postgresql_where=text("status = 'held'")),
        Index("ix_seats_reservation_id", "reservation_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    zone_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("zones.id", ondelete="CASCADE"), nullable=False)
    row_label: Mapped[str] = mapped_column(String(10), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'available'"))
    held_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reservation_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    zone: Mapped[Zone] = relationship(back_populates="seats")
    reservation: Mapped[Optional[Reservation]] = relationship(back_populates="seats")
    tickets: Mapped[list[Ticket]] = relationship(back_populates="seat")


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("order_number", name="uq_orders_order_number"),
        UniqueConstraint("reservation_id"),
        CheckConstraint("total_amount >= 0", name="ck_orders_total_nonnegative"),
        CheckConstraint(
            "status IN ('pending', 'paid', 'cancelled', 'failed')",
            name="ck_orders_status",
        ),
        CheckConstraint(
            "payment_status IN ('unpaid', 'paid', 'failed', 'refunded')",
            name="ck_orders_payment_status",
        ),
        CheckConstraint(
            "refund_status IN ('none', 'requested', 'refunded', 'rejected')",
            name="ck_orders_refund_status",
        ),
        CheckConstraint(
            "refund_amount >= 0 AND refund_amount <= total_amount",
            name="ck_orders_refund_amount",
        ),
        CheckConstraint(
            "payment_status NOT IN ('paid', 'refunded') OR paid_at IS NOT NULL",
            name="ck_orders_paid_at",
        ),
        CheckConstraint(
            "refund_status <> 'refunded' OR refunded_at IS NOT NULL",
            name="ck_orders_refunded_at",
        ),
        Index("ix_orders_user_created_at", "user_id", text("created_at DESC")),
        Index("ix_orders_concert_id", "concert_id"),
        Index("ix_orders_status", "status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    order_number: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        server_default=text("nextval('order_number_seq')"),
    )
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=False)
    concert_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("concerts.id"), nullable=False)
    reservation_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("reservations.id"),
        nullable=True,
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'pending'"))
    payment_method: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'unpaid'"))
    payment_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'none'"))
    refund_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 0), nullable=False, server_default=text("0")
    )
    refund_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user: Mapped[User] = relationship(back_populates="orders")
    concert: Mapped[Concert] = relationship(back_populates="orders")
    reservation: Mapped[Optional[Reservation]] = relationship(back_populates="order")
    tickets: Mapped[list[Ticket]] = relationship(back_populates="order", cascade="all, delete-orphan")


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint("ticket_code", name="uq_tickets_ticket_code"),
        CheckConstraint("price >= 0", name="ck_tickets_price_nonnegative"),
        CheckConstraint(
            "status IN ('valid', 'used', 'cancelled', 'refunded')",
            name="ck_tickets_status",
        ),
        CheckConstraint(
            "(status = 'used') = (checked_in_at IS NOT NULL)",
            name="ck_tickets_checkin_status",
        ),
        Index(
            "uq_tickets_seat_active",
            "seat_id",
            unique=True,
            postgresql_where=text("status IN ('valid', 'used')"),
        ),
        Index("ix_tickets_order_id", "order_id"),
        Index("ix_tickets_concert_id", "concert_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    order_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    concert_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("concerts.id"), nullable=False)
    seat_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("seats.id"), nullable=False)
    ticket_code: Mapped[str] = mapped_column(String(64), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 0), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'valid'"))
    checked_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    order: Mapped[Order] = relationship(back_populates="tickets")
    concert: Mapped[Concert] = relationship(back_populates="tickets")
    seat: Mapped[Seat] = relationship(back_populates="tickets")
    checked_in_user: Mapped[Optional[User]] = relationship(
        back_populates="checked_in_tickets",
        foreign_keys=[checked_in_by],
    )
