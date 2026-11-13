"""Run the backend, starting the dedicated project-local PostgreSQL when configured.

From the project root: python3 backend/scripts/dev.py
"""
from pathlib import Path
import os
import shutil
import subprocess
import sys

BACKEND = Path(__file__).resolve().parents[1]
python = BACKEND / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not python.exists():
    raise SystemExit('Create backend/.venv and install backend/requirements.txt first.')
cluster = BACKEND / '.local/postgres'
if cluster.exists():
    pg_ctl = shutil.which('pg_ctl')
    if not pg_ctl and Path('/Library/PostgreSQL/16/bin/pg_ctl').exists():
        pg_ctl = '/Library/PostgreSQL/16/bin/pg_ctl'
    if not pg_ctl:
        raise SystemExit('PostgreSQL pg_ctl was not found. Add its bin directory to PATH.')
    running = subprocess.run([pg_ctl, '-D', str(cluster), 'status'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if running.returncode:
        subprocess.run([pg_ctl, '-D', str(cluster), '-l', str(BACKEND / '.local/postgres.log'), 'start'], check=True)
if not (BACKEND / '.env').exists():
    raise SystemExit('Configure backend/.env with DATABASE_URL and JWT_SECRET first.')
os.chdir(BACKEND)
os.execv(str(python), [str(python), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload', '--reload-dir', str(BACKEND / 'app')])
