import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import EXPIRY_SWEEP_INTERVAL
from app.database import SessionLocal
from app.errors import DomainError
from app.routers import reservations, seats
from app.services.reservations import expire_stale_holds

log = logging.getLogger("concertly")


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


app = FastAPI(title="Concertly API", lifespan=lifespan)

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
    return _error(exc.status_code, detail["code"], detail["message"])


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    fields = [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"]} for e in exc.errors()]
    return _error(422, "validation_error", "Invalid request.", fields=fields)


@app.get("/api/health")
def health():
    return {"status": "ok"}


for router in (seats.router, reservations.router):
    app.include_router(router, prefix="/api")
