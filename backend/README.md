# Concertly backend

FastAPI + SQLAlchemy + PostgreSQL. Covers seat holds, mock checkout, orders and tickets.

## Run

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL and JWT_SECRET
psql "$DATABASE_URL" -f schema.sql   # once, on an empty database
python scripts/seed.py          # concerts c1-c11, admin + 2 customers, sample orders (idempotent)
uvicorn app.main:app --reload --port 8000
```

The static frontend calls `http://localhost:8000/api` (override with `window.CONCERTLY_API_BASE`).
If the API is not running, the ticket page falls back to the old zone + quantity mock flow.

## Authentication

Send `Authorization: Bearer <jwt>`. Tokens are HS256 JWTs signed with `JWT_SECRET` whose `sub`
is the user's e-mail (`app/security.py`); the user and role are always re-read from the database.
Missing/invalid/expired token or inactive user → **401**; a valid user without the right role → **403**.

The old `X-User-Id` header still works **only** when `ALLOW_DEV_USER_HEADER=1` (local development,
until the frontend sends real tokens). Never enable it in production: anyone can forge it.
Role `staff`/`admin` is required for check-in; `admin` for everything under `/api/admin`.

## Endpoints (`/api`)

| Method & path | Purpose |
| --- | --- |
| `GET /concerts/{id}/seats` | Zones and seat availability (lapsed holds show as available) |
| `POST /reservations` `{concert_id, seat_ids}` | Hold seats for 5 min (all-or-nothing, max 8) — **409 `seat_unavailable`** |
| `GET /reservations/{id}` | Hold status and `seconds_left` |
| `DELETE /reservations/{id}` | Release a hold |
| `POST /checkout` `{reservation_id, payment_method}` | Mock payment → paid order + tickets. `payment_method`: `card`, `ewallet`, `bank_transfer`. Idempotent. **410 `reservation_expired`** |
| `GET /orders`, `GET /orders/{id}` | The caller's orders |
| `POST /orders/{id}/cancel` | Cancel + mock full refund; frees seats. Allowed until 24 h before the show |
| `GET /tickets`, `GET /tickets/{id}` | The caller's tickets |
| `POST /tickets/check-in` `{ticket_code}` | Staff scan; a ticket can be admitted once |
| `GET /admin/stats` | Admin: `totalConcerts`, `ticketsSold`, `totalOrders`, `totalRevenue`, `upcomingConcerts` |
| `GET /admin/orders?status=&concert_id=&q=&page=&page_size=` | Admin: all orders with customer, newest first. `status`: `pending`, `paid`, `cancelled`, `failed`, `refunded`; `q` matches order number, customer e-mail/name, concert title/artist |
| `GET /admin/orders/{id}` | Admin: order detail with customer and tickets |

Dashboard rules (`app/services/admin.py`): revenue = `total_amount - refund_amount` of orders with
`payment_status = 'paid'` (pending, failed and refunded orders count for nothing); tickets sold =
tickets `valid` or `used`; upcoming = not started yet and `on_sale`/`sold_out`.

Errors always look like `{"error": {"code", "message", ...}}`.

## How double-booking is prevented

* Every write locks the seat rows with `SELECT … FOR UPDATE` in ascending id order, then the
  reservation / order rows, so transactions cannot deadlock each other (a retry wrapper covers
  the rare case anyway). The loser of a race waits, re-reads the seat as `held`, and gets 409.
* Expiry uses the database clock. Lapsed holds are released lazily by whoever touches the seat
  and eagerly by a background sweeper every 30 s (`DISABLE_SWEEPER=1` turns it off).
* Checkout re-verifies, under lock, that every seat is still held by that reservation and not
  expired, before creating the order.
* The schema's partial unique index on active tickets is the last line of defence.

## Tests

Tests need a real PostgreSQL (row locks, partial indexes). **They drop and recreate all tables**,
so `TEST_DATABASE_URL` must point at a throwaway database whose name contains `test`
(the suite refuses anything else).

```bash
createdb concertly_test
TEST_DATABASE_URL=postgresql+psycopg2://USER@localhost/concertly_test \
  pytest -q          # pip install -r requirements-dev.txt first
```

`tests/test_concurrency.py` runs simultaneous bookings from many threads (same seat,
overlapping seat sets, concurrent checkout / cancel / check-in / sweeper).
