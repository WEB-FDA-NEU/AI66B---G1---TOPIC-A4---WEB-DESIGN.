import functools

from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session

from app.config import MAX_TX_RETRIES

# PostgreSQL SQLSTATEs: 40P01 deadlock_detected, 40001 serialization_failure.
_RETRYABLE = {"40P01", "40001"}


def _is_retryable(exc: Exception) -> bool:
    orig = getattr(exc, "orig", None)
    return getattr(orig, "pgcode", None) in _RETRYABLE


def transactional(func):
    """Run a service function as one DB transaction.

    Commits on success, rolls back on any error, and transparently retries when
    PostgreSQL aborts the transaction because of a deadlock. The first argument of the
    wrapped function must be the SQLAlchemy Session.
    """

    @functools.wraps(func)
    def wrapper(db: Session, *args, **kwargs):
        attempt = 0
        while True:
            attempt += 1
            try:
                result = func(db, *args, **kwargs)
                db.commit()
                return result
            except (OperationalError, DBAPIError) as exc:
                db.rollback()
                if _is_retryable(exc) and attempt < MAX_TX_RETRIES:
                    continue
                raise
            except Exception:
                db.rollback()
                raise

    return wrapper
