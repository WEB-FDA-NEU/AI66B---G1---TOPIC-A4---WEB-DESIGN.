"""Initialize only the project's dedicated local database; never reset existing tables."""
from pathlib import Path
import sys
from urllib.parse import urlsplit

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from dotenv import load_dotenv
import os
import psycopg2
from psycopg2 import sql

load_dotenv(BACKEND / '.env')
url = urlsplit(os.environ.get('DATABASE_URL', ''))
if (url.hostname, url.port, url.username, url.path) != ('127.0.0.1', 55440, 'concertly_dev', '/concertly_dev'):
    raise SystemExit('This helper only initializes the dedicated local concertly_dev database on port 55440.')
params = dict(host=url.hostname, port=url.port, user=url.username, password=url.password)
admin = psycopg2.connect(dbname='postgres', **params)
admin.autocommit = True
try:
    with admin.cursor() as cur:
        cur.execute('SELECT 1 FROM pg_database WHERE datname=%s', ('concertly_dev',))
        if cur.fetchone() is None:
            cur.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier('concertly_dev')))
finally:
    admin.close()
with psycopg2.connect(dbname='concertly_dev', **params) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
        empty = cur.fetchone()[0] == 0
        if empty:
            cur.execute((BACKEND / 'schema.sql').read_text())
if empty:
    from app.database import SessionLocal
    from scripts.seed import seed, load_data
    with SessionLocal() as db:
        counts = seed(db, load_data(), out=lambda *_: None)
        db.commit()
    print('Local database initialized:', counts)
else:
    print('Existing local tables preserved; no seed or schema changes made.')
print('Demo account: minhanh@concertly.dev; password is SEED_USER_PASSWORD in backend/.env.')
