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
If the API cannot be reached, booking is disabled and a retry button is shown. New purchases never fall back to local mock orders. The old demo receipt reader remains only for saved legacy checkout sessions, clearly marked as demo and without admission QR codes.

## Authentication

Sign in with `POST /api/auth/login` (form fields `username` = e-mail, `password`), which returns
`{access_token, token_type, user}`; `GET /api/auth/me` returns the signed-in user. The frontend keeps
the token in `localStorage.token` (`js/api.js`). Registration and password changes belong to the auth
task (#47). Send `Authorization: Bearer <jwt>`. Tokens are HS256 JWTs signed with `JWT_SECRET` whose `sub`
is the user's e-mail (`app/security.py`); the user and role are always re-read from the database.
Missing/invalid/expired token or inactive user → **401**; a valid user without the right role → **403**.

The old `X-User-Id` header still works **only** when `ALLOW_DEV_USER_HEADER=1` (local development,
until the frontend sends real tokens). Never enable it in production: anyone can forge it.
Role `staff`/`admin` is required for check-in; `admin` for everything under `/api/admin`.

## Endpoints (`/api`)

| Method & path | Purpose |
| --- | --- |
| `GET /concerts/{id}/seats` | Zones and seat availability (lapsed holds show as available) |
| `POST /reservations` `{concert_id, seat_ids?, standing?: [{zone_id, quantity}]}` | Hold numbered seats and/or standing inventory for 5 min (all-or-nothing, max 6 combined) — **409 `seat_unavailable` / `standing_unavailable`** |
| `GET /reservations/{id}` | Hold status and `seconds_left` |
| `DELETE /reservations/{id}` | Release a hold |
| `POST /checkout` `{reservation_id, payment_method, buyer: {full_name, email, phone}}` | Mock payment → paid order + tickets. `payment_method`: `card`, `ewallet`, `bank_transfer`. Idempotent. **410 `reservation_expired`** |
| `POST /auth/login`, `GET /auth/me` | Sign in (OAuth2 password form) / current user |
| `GET /orders/me` (alias `/orders`), `GET /orders/{id}` | The caller's orders (someone else's order → 404) |
| `POST /orders/{id}/cancel` | Cancel + mock full refund; frees seats. Owner only; pending/paid, no used tickets; more than 24 h before the show, except cancelled concerts waive the cutoff |
| `GET /tickets/me` (alias `/tickets`), `GET /tickets/{id}` | The caller's tickets. `qr_data` (the ticket code) is set only while the ticket is `valid`; the detail also returns `qr_image`, an SVG data URI rendered by the server |
| `POST /tickets/check-in` `{ticket_code}` | Staff scan; a ticket can be admitted once |
| `GET /admin/stats` | Admin: `totalConcerts`, `ticketsSold`, `totalOrders`, `totalRevenue`, `upcomingConcerts`, plus `checkinsToday` (tickets checked in since midnight) |
| `GET /admin/stats/concerts` | Admin: every concert (soonest first) with `capacity`, `ticketsSold`, `checkedIn`, `revenue` and `upcoming`, same rules as `/admin/stats` |
| `GET /admin/orders?status=&concert_id=&q=&page=&page_size=` | Admin: all orders with customer, newest first. `status`: `pending`, `paid`, `cancelled`, `failed`, `refunded`; `q` matches order number, customer e-mail/name, concert title/artist |
| `GET /admin/orders/{id}` | Admin: order detail with customer and tickets |
| `GET /admin/concerts/{id}/attendees` | Admin: holders of `valid`/`used` tickets with customer, seat and check-in time, plus `total` / `checked_in` / `not_checked_in` |
| `POST /admin/checkin` `{ticketId, concertId}` | Admin gate check-in. `ticketId` is the ticket id or its code (QR). Sets the ticket to `used` with `checked_in_at` (the "used at" time) and `checked_in_by`. **404** unknown ticket, **409 `ticket_already_used`**, **400 `wrong_concert`** / **`ticket_not_valid`** (cancelled or refunded). One atomic conditional UPDATE, so concurrent scans admit a ticket once |

Dashboard rules (`app/services/admin.py`): revenue = `total_amount - refund_amount` of orders with
`payment_status = 'paid'` (pending, failed and refunded orders count for nothing); tickets sold =
tickets `valid` or `used`; upcoming = not started yet and `on_sale`/`sold_out`.

Checkout requires valid buyer contact details, including a 2–150 character name, an email address, and a phone number with 8–15 digits. These fields are validated without overwriting the account or changing the database schema. Existing order IDs, ticket codes and QR payloads are preserved; concert prefixes are display labels only.

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

## Standing and Seated (demo configuration)

`app/venue_zones.json` explicitly classifies the 33 existing ticket tiers. The 11 SVG map files carry matching `bookingType` metadata. The polygon update adjusted only CENTER PREMIUM in c1/c5/c6 so it widens towards the stage; standing shapes and ticket prices are unchanged. See `../docs/standing-seated.md` for the complete concert/tier matrix.

- Seated zones expose PostgreSQL seat IDs, rows, numbers and live availability. Reserve specific IDs via `seat_ids`.
- Standing zones expose availability counts, never numbered seats. Reserve a zone and quantity via `standing`.
- Both modes reuse the existing `seats` inventory rows, row locks, five-minute expiry, checkout, refund and QR lifecycle. Standing rows act as inventory units internally, not assigned seats. No database schema changes or migration of existing bookings is required.
- HTTP reservation requests reject standing inventory IDs in `seat_ids`, and reject a seated zone in `standing`. The maximum of 6 applies to the combined request.
- `booking_type` is added to reservation items and tickets. Public standing `row`/`row_label`/`seat_number` are null. Existing IDs, stored row values, ticket codes and QR payloads are not rewritten.
- Unknown legacy zones retain their existing numbered-seat contract. Configure new zones explicitly before advertising them as Standing.
- Multiple SVG sections with the same ticket-tier name share that tier's inventory; the existing seats are allocated once across its SVG fragments for display. This configuration is not an assertion about the artists' real seating plans.

For the current UI and executable QA commands, see [Current UI and QA](../docs/current-ui-qa.md). Historical UI reports describe earlier iterations.

## Sample data (task #55)

11 concerts, 33 tiers, 7,200 inventory units and 14 sample orders. See [seed-data.md](../docs/seed-data.md) for the full price/capacity matrix, dashboard expectations, safe seed commands and TV1 review checklist. Run `python -B scripts/seed.py --check` before an authorized seed. Never use the application database as a pytest fixture.
