import sys
import os
from contextvars import ContextVar
from prisma import Prisma

_db_context: ContextVar[Prisma | None] = ContextVar("db", default=None)


def get_db() -> Prisma:
    """Get current Prisma client from context."""
    db = _db_context.get()
    if db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return db


async def init_db() -> Prisma:
    """Initialize a new Prisma client and store in context."""
    # Redirect stdout/stderr to avoid Celery LoggingProxy issues
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = sys.__stdout__
    sys.stderr = sys.__stderr__

    try:
        db = Prisma()
        await db.connect()
        _db_context.set(db)
        return db
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr


async def close_db() -> None:
    """Close current Prisma client."""
    db = _db_context.get()
    if db:
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__

        try:
            await db.disconnect()
            _db_context.set(None)
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
