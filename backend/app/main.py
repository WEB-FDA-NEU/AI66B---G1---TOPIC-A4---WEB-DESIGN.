import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import EXPIRY_SWEEP_INTERVAL
from app.database import SessionLocal
from app.errors import DomainError
from app.routers import admin, auth, orders, reservations, seats
from app.services.reservations import expire_stale_holds

log = logging.getLogger("concertly")
FRONTEND_DIR = Path(__file__).resolve().parents[2]


def _sweep_once() -> int:
    with SessionLocal() as db:
        return expire_stale_holds(db)


async def _sweeper() -> None:
    """Periodically return expired holds to the pool (lazy expiry already protects correctness)."""
    while True:
        await asyncio.sleep(EXPIRY_SWEEP_INTERVAL)
        try:
            freed = await asyncio.to_thread(_sweep_once)
            if freed:
                log.info("released %s expired seat holds", freed)
        except Exception:  # never let the sweeper die
            log.exception("expiry sweep failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None if os.getenv("DISABLE_SWEEPER") == "1" else asyncio.create_task(_sweeper())
    yield
    if task:
        task.cancel()


app = FastAPI(title="Concertly API", version="1.0.0", lifespan=lifespan)
admin.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=admin.UPLOAD_DIR), name="uploads")

# The static frontend is served from a different origin in development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error(status: int, code: str, message: str, **details) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, **details}})


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError):
    return _error(exc.status_code, exc.code, exc.message, **exc.details)


@app.exception_handler(HTTPException)
async def http_error_handler(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "http_error", "message": str(exc.detail)}
    response = _error(exc.status_code, detail["code"], detail["message"])
    if exc.headers:
        response.headers.update(exc.headers)
    return response


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    fields = [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"]} for e in exc.errors()]
    return _error(422, "validation_error", "Invalid request.", fields=fields)


@app.get("/api/health")
def health():
    return {"status": "ok"}


for router in (auth.router, seats.router, reservations.router, orders.router, admin.router):
    app.include_router(router, prefix="/api")

# Frontend: chỉ public đúng các thư mục này, đặt SAU tất cả route /api
for folder in ("assets", "css", "js", "pages"):
    folder_path = FRONTEND_DIR / folder
    if folder_path.exists():
        app.mount(f"/{folder}", StaticFiles(directory=folder_path), name=folder)


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(FRONTEND_DIR / "index.html")
