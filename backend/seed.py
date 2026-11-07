"""Load demo data: the 11 concerts of the frontend mock data, each with seat grids.

    python seed.py            # only seeds an empty database
    python seed.py --reset    # wipes concerts/seats/orders/users first (DESTRUCTIVE)

Concert ids equal the number in the frontend id ("c3" -> 3) so the static pages can talk
to the API without an extra lookup table. seed_concerts.json is generated from
js/mock-data.js. Zones that the mock data marks "Sold Out" get no seats (0 available).
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text

from app.database import SessionLocal
from app.models import Concert, Seat, User, Zone

ROWS = "ABCDE"
SEATS_PER_ROW = 10
ZONE_COLORS = ["#ff4f9a", "#8b5cf6", "#22d3ee", "#facc15"]


def main(reset: bool) -> None:
    data = json.loads((Path(__file__).parent / "seed_concerts.json").read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        if reset:
            db.execute(text("TRUNCATE tickets, orders, seats, reservations, zones, concerts, users RESTART IDENTITY CASCADE"))
            db.execute(text("ALTER SEQUENCE order_number_seq RESTART WITH 10483"))
        elif db.query(Concert).count():
            print("Database already has concerts; use --reset to reseed.")
            return

        # password_hash is a placeholder: these accounts cannot log in until real auth exists.
        db.add_all([
            User(id=1, email="demo@concertly.dev", password_hash="!seed-no-login", full_name="Demo Customer"),
            User(id=2, email="staff@concertly.dev", password_hash="!seed-no-login", full_name="Demo Staff", role="staff"),
        ])
        for c in data:
            starts = datetime.fromisoformat(f"{c['date']}T{c['time']}:00").replace(tzinfo=timezone.utc)
            concert = Concert(
                id=c["id"],
                title=c["title"],
                artist=c["artist"],
                description=c["description"],
                venue=c["location"].split(",")[0],
                city=", ".join(c["location"].split(",")[1:]).strip() or c["location"],
                poster_url=c["poster"],
                starts_at=starts,
                sale_start_at=now.replace(year=now.year - 1),
                status="on_sale" if starts > now else "completed",
            )
            db.add(concert)
            db.flush()
            for i, z in enumerate(c["zones"]):
                capacity = len(ROWS) * SEATS_PER_ROW
                zone = Zone(concert_id=concert.id, name=z["name"], price=z["price"], capacity=capacity, color=ZONE_COLORS[i % 4])
                db.add(zone)
                db.flush()
                if z["soldOut"]:
                    continue
                db.add_all(
                    Seat(zone_id=zone.id, row_label=row, seat_number=n)
                    for row in ROWS
                    for n in range(1, SEATS_PER_ROW + 1)
                )
        db.flush()
        # ids were inserted explicitly, so move the identity counter past them
        db.execute(text("SELECT setval(pg_get_serial_sequence('concerts','id'), (SELECT max(id) FROM concerts))"))
        db.execute(text("SELECT setval(pg_get_serial_sequence('users','id'), (SELECT max(id) FROM users))"))
        db.commit()
        print(f"Seeded {len(data)} concerts, users 1 (customer) and 2 (staff).")


if __name__ == "__main__":
    main("--reset" in sys.argv)
