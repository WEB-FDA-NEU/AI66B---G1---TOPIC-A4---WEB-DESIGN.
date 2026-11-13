# Deploy CONCERTLY on Render

This guide describes the production layout and deployment steps for this repository.
The API runs as a Render Web Service backed by managed PostgreSQL. The frontend is
static and must be hosted at a public URL as well; this repository's FastAPI app does
not serve the frontend files.

## Current deployment

| Component | Public URL |
| --- | --- |
| Frontend | [concertly-trang-dat-ve-concert.onrender.com](https://concertly-trang-dat-ve-concert.onrender.com) |
| Backend API | [concertly.onrender.com](https://concertly.onrender.com) |
| API docs | [concertly.onrender.com/docs](https://concertly.onrender.com/docs) |

Live smoke check on 2026-11-14: the frontend returned HTTP 200, `/docs` returned
HTTP 200, and `/api/health` returned HTTP 200 with `{"status":"ok"}`. The production
database was missing `zones.booking_type`, so `/api/concerts` initially returned
HTTP 500. An operator applied
`migrations/001_zone_booking_type.sql` successfully; a follow-up request to
`/api/concerts` returned concert data including each zone's `booking_type`.

## 1. Create the PostgreSQL database

Create a managed PostgreSQL database in Render (or use an approved PostgreSQL
provider). Prefer the provider's **internal** connection URL when the database and
Web Service are in the same private network/region. Otherwise use its external URL
and follow the provider's SSL requirements.

Keep the database URL private. Set `DATABASE_URL` on the Web Service to the URL for
the production database. The application accepts `postgres://` and `postgresql://`
URLs and configures the PostgreSQL driver.

## 2. Create the API Web Service

Create a Render Web Service for this repository and configure:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

Render supplies `PORT` at runtime. Do not hard-code a local development port in the
production start command.

Add these environment variables in the service settings:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Production PostgreSQL connection URL |
| `JWT_SECRET` | A unique, randomly generated secret; do not reuse a development or test secret |
| `CORS_ORIGINS` | Comma-separated exact origins of the deployed frontend, with no path |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional; defaults to `60` |

Do not set `ALLOW_DEV_USER_HEADER=1` in production. Do not commit `.env` files,
database URLs, passwords, JWT secrets, or seed credentials.

## 3. Initialize or update the database

For a **new, empty** production database, apply the schema once from the repository's
`backend` directory using a trusted machine with `psql` installed:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f schema.sql
```

For an **existing** database missing `zones.booking_type`, back up the database,
then have an authorized operator apply the migration (not `schema.sql`). If `psql`
is unavailable but Python and the project's dependencies are installed, run from
the `backend` directory after setting `DATABASE_URL` in the current PowerShell
session:

```powershell
.\.venv\Scripts\python.exe -c "import os; from pathlib import Path; import psycopg2; conn=psycopg2.connect(os.environ['DATABASE_URL']); cur=conn.cursor(); cur.execute(Path('migrations/001_zone_booking_type.sql').read_text(encoding='utf-8')); conn.commit(); cur.close(); conn.close(); print('Migration applied successfully')"
```

Confirm the migration's success and verify the database-backed `/api/concerts`
endpoint afterward. Never put the production connection URL in source control or
share it in logs/issues.

Only seed production when the deployment is intentionally a demo and an authorized
operator has approved populating it with the repository's sample concerts, users,
and orders. Set strong, unique `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`
environment variables before running the seed command:

```powershell
python scripts/seed.py
```

The seed script is idempotent, but it adds demo data; do not run it automatically
on every service startup or use it to populate a production database containing
real customer data.

For any **existing** database, do not re-run `schema.sql` as a migration. Back up
the database and review pending migrations before deploying. Migrations are not
automatically applied at application startup. Follow the
[backend database migration guide](../backend/README.md#database-setup-and-migrations).

## 4. Deploy the frontend and connect it to the API

The frontend is hosted at
`https://concertly-trang-dat-ve-concert.onrender.com`. Set
`window.CONCERTLY_API_BASE` to the backend URL plus `/api`, before loading
`js/api.js`:

```html
<script>
  window.CONCERTLY_API_BASE = "https://concertly.onrender.com/api";
</script>
<script src="/js/api.js"></script>
```

Set `CORS_ORIGINS` on the API service to the frontend's exact origin:
`https://concertly-trang-dat-ve-concert.onrender.com`. Include additional origins
only when they are required. Do not include a trailing slash or URL path in an
origin. Redeploy/restart the API after changing its environment variables.

## 5. Verify the deployment

Use the deployed URLs above:

1. Open `https://concertly.onrender.com/docs` and confirm the API documentation loads.
2. Request `https://concertly.onrender.com/api/health`; expect HTTP 200 and
   `{"status":"ok"}`. This checks that the web process responds; it does **not** check
   database connectivity.
3. Request `https://concertly.onrender.com/api/concerts`; verify the catalog responds
   with the expected public data and zone `booking_type` values. This exercises the
   database-backed API and was confirmed working after the migration on 2026-11-14.
4. Open `https://concertly-trang-dat-ve-concert.onrender.com` over HTTPS, confirm it
   loads from a second device or
   mobile network, and verify that its browser requests go to the deployed API (not
   `localhost`) without CORS errors.
5. Test login and a non-destructive read-only flow with an authorized test account.
   Avoid creating or cancelling real orders during a smoke test.
6. Restart/redeploy the Web Service and repeat the catalog check. Confirm the
   database and its records are still present.

Record the final API/frontend URLs and verification date in the team's deployment
record or issue. Do not put credentials, private database URLs, or secret values in
that record.

## Operational notes

- Render's local filesystem may be ephemeral. Concert images uploaded to
  `backend/app/uploads/` can be lost when an instance is replaced unless a persistent
  disk is attached and mounted at the matching path. For multiple instances or
  durable image storage, use an object-storage service and configure the application
  accordingly.
- Keep database backups and apply schema changes through reviewed migrations. Never
  point the automated test suite at production; it drops and recreates its test
  tables.
- Set production `CORS_ORIGINS` narrowly. The development default of `*` is not a
  suitable production policy.
- Render may sleep or restart services depending on the selected plan. Check service
  health and logs in the Render dashboard when diagnosing cold starts or errors.
