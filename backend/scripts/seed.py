"""Seed the database with the demo catalogue, accounts and sample orders.

    cd backend
    python scripts/seed.py                      # seed (safe to run any number of times)
    python scripts/seed.py --check              # validate seed_data.json only, no DB access
    python scripts/seed.py --no-sample-orders   # catalogue + admin only (e.g. production)

Data comes from ``scripts/seed_data.json`` (converted from ``js/mock-data.js``):

* Concert ids equal the number in the frontend id (``"c3"`` -> 3) and are kept as-is.
* Tier (zone) names match the section names in ``js/venues/<slug>-map.js`` exactly and
  the tier capacities of a concert add up to its ``ticketCapacity``.
* Every tier gets ``capacity`` inventory rows (rows A, B, ... of ``SEATS_PER_ROW``).
  Explicitly Seated tiers expose these labels to buyers; Standing tiers use the same
  rows internally as quantity inventory without public seat assignments.
  Tiers marked ``soldOut`` in the mock data get their seats created as ``sold`` so the
  seat map shows them as unavailable; they have no tickets, so they are not counted as
  tickets sold or revenue.

Idempotency: every row is looked up by a natural key (user e-mail, concert id,
tier name, seat label, order number) and only inserted when missing. Existing rows are
never updated or deleted, so re-running never duplicates data and never overwrites
changes made through the application (passwords, statuses, check-ins...). The whole
run is one transaction guarded by an advisory lock, so a failed or concurrent run
leaves nothing half-written.

Passwords are never stored in the repository. Each account reads its password from the
environment variable named by ``passwordEnv`` (``SEED_ADMIN_PASSWORD`` /
``SEED_USER_PASSWORD``). When the variable is unset a random password is generated and
printed once, at the moment the account is created.

Sample order statuses: ``paid``, ``pending`` (awaiting payment, no tickets yet),
``failed`` (payment failed, no tickets), ``cancelled`` (cancelled before payment, no
tickets) and ``refunded`` (paid, then cancelled with a full refund; tickets refunded).
A paid order with ``checkedInAt`` has its tickets checked in (status ``used``).
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import uuid
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.venue_catalog import booking_type as seed_booking_type

DATA_FILE = Path(__file__).with_name("seed_data.json")
SEATS_PER_ROW = 20
# Arbitrary constant key for pg_advisory_xact_lock so two seed runs never interleave.
SEED_LOCK_KEY = 4_834_034
ORDER_STATUSES = ("paid", "pending", "failed", "cancelled", "refunded")
ROLES = ("customer", "staff", "admin")


class SeedDataError(ValueError):
    """seed_data.json is inconsistent; nothing was written."""


# --------------------------------------------------------------------------- helpers

def row_label(index: int) -> str:
    """0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ... (spreadsheet-style)."""
    label = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        label = chr(65 + rem) + label
    return label


def seat_labels(capacity: int) -> list[tuple[str, int]]:
    """The (row, number) labels of a tier with ``capacity`` seats."""
    return [(row_label(i // SEATS_PER_ROW), i % SEATS_PER_ROW + 1) for i in range(capacity)]


def parse_ts(value: str) -> datetime:
    ts = datetime.fromisoformat(value)
    if ts.tzinfo is None:
        raise SeedDataError(f"Timestamp {value!r} must include a UTC offset.")
    return ts


def hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def load_data(path: Path = DATA_FILE) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


# ------------------------------------------------------------------------ validation

def validate(data: dict) -> None:
    """Raise SeedDataError describing every problem found in the seed data."""
    problems: list[str] = []
    users = {u["email"].lower(): u for u in data.get("users", [])}
    if len(users) != len(data.get("users", [])):
        problems.append("Duplicate user e-mails.")
    for user in users.values():
        if user.get("role") not in ROLES:
            problems.append(f"User {user['email']}: unknown role {user.get('role')!r}.")
    if not any(u.get("role") == "admin" for u in users.values()):
        problems.append("At least one admin account is required.")

    concerts = {}
    for concert in data.get("concerts", []):
        cid = concert["id"]
        if cid in concerts:
            problems.append(f"Duplicate concert id {cid}.")
        concerts[cid] = concert
        if concert.get("slug") != f"c{cid}":
            problems.append(f"Concert {cid}: slug must be 'c{cid}'.")
        try:
            parse_ts(concert["startsAt"])
        except (SeedDataError, ValueError) as exc:
            problems.append(f"Concert {cid}: {exc}")
        names = [t["name"] for t in concert["tiers"]]
        if len(set(names)) != len(names):
            problems.append(f"Concert {cid}: duplicate tier names.")
        total = sum(t["capacity"] for t in concert["tiers"])
        if total != concert["ticketCapacity"]:
            problems.append(
                f"Concert {cid}: tier capacities sum to {total}, ticketCapacity is {concert['ticketCapacity']}."
            )
        for tier in concert["tiers"]:
            if tier["capacity"] <= 0 or tier["price"] < 0:
                problems.append(f"Concert {cid} tier {tier['name']!r}: invalid capacity/price.")

    numbers = Counter(o["orderNumber"] for o in data.get("orders", []))
    problems += [f"Duplicate order number {n}." for n, c in numbers.items() if c > 1]
    taken: dict[tuple, int] = {}
    for order in data.get("orders", []):
        num = order["orderNumber"]
        if order["user"].lower() not in users:
            problems.append(f"Order {num}: unknown user {order['user']}.")
        if order["status"] not in ORDER_STATUSES:
            problems.append(f"Order {num}: unknown status {order['status']!r}.")
        if order.get("checkedInAt") and order["status"] != "paid":
            problems.append(f"Order {num}: only paid orders can be checked in.")
        if order["status"] == "refunded" and not order.get("refundedAt"):
            problems.append(f"Order {num}: refunded orders need refundedAt.")
        concert = concerts.get(order["concertId"])
        if concert is None:
            problems.append(f"Order {num}: unknown concert {order['concertId']}.")
            continue
        if not order.get("seats"):
            problems.append(f"Order {num}: needs at least one seat.")
        tiers = {t["name"]: t for t in concert["tiers"]}
        for seat in order.get("seats", []):
            tier = tiers.get(seat["tier"])
            if tier is None:
                problems.append(f"Order {num}: concert {concert['id']} has no tier {seat['tier']!r}.")
                continue
            if (seat["row"], seat["seat"]) not in set(seat_labels(tier["capacity"])):
                problems.append(f"Order {num}: seat {seat['row']}{seat['seat']} is outside {seat['tier']!r}.")
            if tier.get("soldOut"):
                problems.append(f"Order {num}: tier {seat['tier']!r} is sold out.")
            if order["status"] == "paid":  # paid orders hold their seat for good
                key = (concert["id"], seat["tier"], seat["row"], seat["seat"])
                if key in taken:
                    problems.append(f"Order {num}: seat {key} already sold in order {taken[key]}.")
                taken[key] = num
    if problems:
        raise SeedDataError("Invalid seed data:\n  - " + "\n  - ".join(problems))


# --------------------------------------------------------------------------- seeding

def seed(db, data: dict, *, sample_orders: bool = True, env: dict | None = None, out=print) -> dict:
    """Insert whatever is missing. Caller owns the transaction (commit/rollback)."""
    from sqlalchemy import func, select, text
    from sqlalchemy.dialects.postgresql import insert

    from app.models import Concert, Order, Seat, User, Zone

    validate(data)
    env = os.environ if env is None else env
    created = Counter()
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": SEED_LOCK_KEY})
    now = db.execute(text("SELECT now()")).scalar_one()

    # Users ---------------------------------------------------------------------------
    user_ids: dict[str, int] = {}
    for spec in data["users"]:
        if spec.get("sample") and not sample_orders:
            continue
        email = spec["email"].lower()
        uid = db.execute(select(User.id).where(func.lower(User.email) == email)).scalar_one_or_none()
        if uid is None:
            password = env.get(spec.get("passwordEnv", "")) or None
            generated = password is None
            password = password or secrets.token_urlsafe(12)
            user = User(
                email=email,
                password_hash=hash_password(password),
                full_name=spec["fullName"],
                phone=spec.get("phone"),
                role=spec["role"],
            )
            db.add(user)
            db.flush()
            uid = user.id
            created["users"] += 1
            hint = f"password: {password}" if generated else f"password from ${spec['passwordEnv']}"
            out(f"Created {spec['role']} {email} ({hint})")
        user_ids[email] = uid
    db.execute(text("SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT max(id) FROM users), 1))"))

    # Concerts, tiers and seats -------------------------------------------------------
    zone_ids: dict[tuple[int, str], int] = {}
    for spec in data["concerts"]:
        starts_at = parse_ts(spec["startsAt"])
        result = db.execute(
            insert(Concert)
            .values(
                id=spec["id"],
                title=spec["title"],
                artist=spec["artist"],
                description=spec.get("description"),
                venue=spec["venue"],
                city=spec["city"],
                poster_url=spec.get("poster"),
                starts_at=starts_at,
                sale_start_at=parse_ts(spec["saleStartAt"]) if spec.get("saleStartAt") else None,
                status="on_sale" if starts_at > now else "completed",
            )
            .on_conflict_do_nothing(index_elements=["id"])
        )
        created["concerts"] += result.rowcount

        for tier in spec["tiers"]:
            result = db.execute(
                insert(Zone)
                .values(
                    concert_id=spec["id"],
                    name=tier["name"],
                    price=tier["price"],
                    capacity=tier["capacity"],
                    booking_type=seed_booking_type(spec["id"], tier["name"]),
                    color=tier.get("color"),
                )
                .on_conflict_do_nothing(constraint="uq_zones_concert_name")
            )
            created["zones"] += result.rowcount
            zone_id = db.execute(
                select(Zone.id).where(Zone.concert_id == spec["id"], Zone.name == tier["name"])
            ).scalar_one()
            zone_ids[(spec["id"], tier["name"])] = zone_id

            existing = set(
                db.execute(select(Seat.row_label, Seat.seat_number).where(Seat.zone_id == zone_id)).all()
            )
            missing = [lbl for lbl in seat_labels(tier["capacity"]) if lbl not in existing]
            if missing:
                status = "sold" if tier.get("soldOut") else "available"
                db.execute(
                    insert(Seat),
                    [{"zone_id": zone_id, "row_label": r, "seat_number": n, "status": status} for r, n in missing],
                )
                created["seats"] += len(missing)
    db.execute(text("SELECT setval(pg_get_serial_sequence('concerts','id'), GREATEST((SELECT max(id) FROM concerts), 1))"))

    # Sample orders -------------------------------------------------------------------
    if sample_orders:
        admin_id = next(user_ids[u["email"].lower()] for u in data["users"] if u["role"] == "admin")
        for spec in data["orders"]:
            if db.execute(select(Order.id).where(Order.order_number == spec["orderNumber"])).first():
                continue  # already seeded (or the number is taken): never touch it again
            _create_order(db, spec, user_ids, zone_ids, admin_id, created)
        # Concerts whose last seat was sold by the samples become sold out, like checkout does.
        db.execute(
            text(
                "UPDATE concerts c SET status = 'sold_out', updated_at = now() "
                "WHERE c.status = 'on_sale' AND NOT EXISTS ("
                "  SELECT 1 FROM seats s JOIN zones z ON z.id = s.zone_id "
                "  WHERE z.concert_id = c.id AND s.status <> 'sold')"
            )
        )
    db.flush()
    return {name: n for name, n in created.items() if n}


def _create_order(db, spec, user_ids, zone_ids, admin_id, created) -> None:
    from sqlalchemy import select

    from app.models import Order, Seat, Ticket, Zone

    seats = []
    for s in spec["seats"]:
        zone_id = zone_ids[(spec["concertId"], s["tier"])]
        seat = db.execute(
            select(Seat)
            .where(Seat.zone_id == zone_id, Seat.row_label == s["row"], Seat.seat_number == s["seat"])
            .with_for_update()
        ).scalar_one()
        seats.append((seat, db.get(Zone, zone_id).price))

    status = spec["status"]
    created_at = parse_ts(spec["createdAt"])
    total = sum(price for _, price in seats)
    issues_tickets = status in ("paid", "refunded")
    if status == "paid" and any(seat.status != "available" for seat, _ in seats):
        raise SeedDataError(
            f"Order {spec['orderNumber']}: a seat is no longer available in the database; "
            "pick other seats in seed_data.json."
        )

    order = Order(
        order_number=spec["orderNumber"],
        user_id=user_ids[spec["user"].lower()],
        concert_id=spec["concertId"],
        total_amount=total,
        status="cancelled" if status == "refunded" else status,
        payment_method=spec.get("paymentMethod"),
        payment_status={"paid": "paid", "refunded": "refunded", "failed": "failed"}.get(status, "unpaid"),
        payment_ref=f"SEED-{spec['orderNumber']}" if issues_tickets else None,
        paid_at=created_at + timedelta(minutes=2) if issues_tickets else None,
        created_at=created_at,
        updated_at=created_at,
    )
    if status == "refunded":
        order.refund_status = "refunded"
        order.refund_amount = total
        order.refund_reason = spec.get("refundReason")
        order.refunded_at = parse_ts(spec["refundedAt"])
        order.updated_at = order.refunded_at
    db.add(order)
    db.flush()
    created["orders"] += 1

    if not issues_tickets:
        return
    checked_in_at = parse_ts(spec["checkedInAt"]) if spec.get("checkedInAt") else None
    for seat, price in seats:
        ticket = Ticket(
            order_id=order.id,
            concert_id=spec["concertId"],
            seat_id=seat.id,
            ticket_code=f"CTL-{uuid.uuid4().hex.upper()}",  # unguessable, like checkout
            price=price,
            status="refunded" if status == "refunded" else ("used" if checked_in_at else "valid"),
            checked_in_at=checked_in_at,
            checked_in_by=admin_id if checked_in_at else None,
            created_at=order.paid_at,
            updated_at=order.updated_at if status == "refunded" else (checked_in_at or order.paid_at),
        )
        db.add(ticket)
        created["tickets"] += 1
        if status == "paid":
            seat.status = "sold"


# ------------------------------------------------------------------------------- CLI

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--file", type=Path, default=DATA_FILE, help="seed data JSON (default: %(default)s)")
    parser.add_argument("--check", action="store_true", help="only validate the seed data; no database access")
    parser.add_argument(
        "--no-sample-orders",
        action="store_true",
        help="skip the sample customer accounts and orders (catalogue + admin only)",
    )
    args = parser.parse_args(argv)

    data = load_data(args.file)
    try:
        validate(data)
    except SeedDataError as exc:
        print(exc, file=sys.stderr)
        return 1
    if args.check:
        print(f"{args.file.name} is valid: {len(data['concerts'])} concerts, {len(data['orders'])} sample orders.")
        return 0

    from app.database import SessionLocal

    with SessionLocal() as db:
        try:
            created = seed(db, data, sample_orders=not args.no_sample_orders)
            db.commit()
        except Exception:
            db.rollback()
            raise
    summary = ", ".join(f"{n} {k}" for k, n in created.items()) or "nothing (already seeded)"
    print(f"Seed complete. Created: {summary}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
