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
| `GET /concerts` | Public concert catalogue for `on_sale` / `sold_out` shows plus IDs managed by the backend |
| `GET /concerts/{id}` | Public details and ticket types for an on-sale / sold-out concert |
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
| `GET /admin/concerts` | Admin: concerts with descriptions, poster URLs, and ticket types/capacities |
| `GET /admin/concerts/{id}` | Admin: one concert with its ticket types/capacities |
| `POST /admin/concerts`, `PUT /admin/concerts/{id}` | Admin: create/update concert and ticket types; creates matching seat inventory. Ticket types with bookings cannot be removed and occupied seats cannot be removed by reducing capacity |
| `DELETE /admin/concerts/{id}` | Admin: delete a concert only if it has no orders or reservations |
| `POST /admin/concerts/upload-image` (`multipart` field `image`) | Admin: store JPG/PNG/WebP poster images up to 5 MB; returns a URL served from `/uploads/` |
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
- Both modes reuse the existing `seats` inventory rows, row locks, five-minute expiry, checkout, refund and QR lifecycle. Standing rows act as inventory units internally, not assigned seats. The zone booking_type column is persistent; existing installations require the explicit migration described below. Existing bookings/seat IDs are not rewritten.
- HTTP reservation requests reject standing inventory IDs in `seat_ids`, and reject a seated zone in `standing`. The maximum of 6 applies to the combined request.
- `booking_type` is added to reservation items and tickets. Public standing `row`/`row_label`/`seat_number` are null. Existing IDs, stored row values, ticket codes and QR payloads are not rewritten.
- New admin zones choose Standing/Seated explicitly. Renaming a zone never changes admission type. Clients omitting booking_type on edit preserve the stored type; new zones default to seated. Changing type is rejected with 409 booking_type_has_bookings when any ticket or occupied inventory exists.
- Multiple SVG sections with the same ticket-tier name share that tier's inventory; the existing seats are allocated once across its SVG fragments for display. This configuration is not an assertion about the artists' real seating plans.

For the current UI and executable QA commands, see [Current UI and QA](../docs/current-ui-qa.md). Historical UI reports describe earlier iterations.


## PR #83 review: persistent admission type

`zones.booking_type` is now the runtime source for reservation validation, seat map,
tickets and check-in. `app/venue_zones.json` is used only when inserting demo seed
zones. Admin concert zone input accepts optional `booking_type` (`seated`/`standing`);
admin/public concert responses always include it. The admin ticket-type form has
an Admission type selector. Omission/null on an existing zone preserves its value.

For an **existing database**, deploy only after an operator applies
`migrations/001_zone_booking_type.sql` using the database's approved connection.
Do not re-run schema.sql as a migration or re-seed. The migration locks zones,
adds the column, backfills the frozen legacy mapping for matching ID/name pairs,
defaults other legacy zones to seated, and enforces allowed values. Re-running
preserves non-null admin choices. It does not change seat/order/ticket IDs, QR or
passwords. Back up the database and schedule the table lock appropriately before
running it in a shared environment. A name already changed before migration has
only the previous fallback seated contract; do not infer Standing from its name.

This migration is **not auto-applied at application startup**, and the review work
only executes it on a throwaway QA database. The running local database has not
been migrated. Fresh databases get the column from schema.sql. New zones in seed
get defaults from JSON; existing zones are not overwritten by a seed rerun.
