from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Environment variable to override DB location 
DB_URL_ENV_VAR = "HOMESCREEN_HERO_DB"

# Default path for local SQLite DB file
DEFAULT_DB_PATH = Path("homescreen_hero.sqlite")

Base = declarative_base()


def _build_db_url() -> str:
    # Determine the DB URL.
    # - If HOMESCREEN_HERO_DB is set, use it (expected full SQLAlchemy URL).
    # - Otherwise default to a local sqlite file.
    env_url = os.environ.get(DB_URL_ENV_VAR)
    if env_url:
        return env_url

    return f"sqlite:///{DEFAULT_DB_PATH.resolve()}"


_engine = create_engine(
    _build_db_url(),
    echo=False,
    future=True,
)

SessionLocal = sessionmaker(
    bind=_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
)


def get_engine():
    return _engine


def get_session() -> Session:
    return SessionLocal()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
