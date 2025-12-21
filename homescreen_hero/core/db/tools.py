from __future__ import annotations

from typing import List

from .base import get_engine, session_scope
from .models import RotationRecord, CollectionUsage



# List last N rotation records
def list_rotations(limit: int = 20) -> List[RotationRecord]:
    # Return the most recent N rotation rows
    with session_scope() as db:
        rows = (
            db.query(RotationRecord)
            .order_by(RotationRecord.id.desc())
            .limit(limit)
            .all()
        )
        return rows


# List all collection usage entries
def list_usage() -> List[CollectionUsage]:
    with session_scope() as db:
        rows = (
            db.query(CollectionUsage)
            .order_by(CollectionUsage.collection_name.asc())
            .all()
        )
        return rows


# Clear all history (drop and recreate tables)
def clear_history() -> None:
    engine = get_engine()

    # Drop everything
    RotationRecord.__table__.drop(engine, checkfirst=True)
    CollectionUsage.__table__.drop(engine, checkfirst=True)

    # Recreate everything fresh
    RotationRecord.__table__.create(engine, checkfirst=True)
    CollectionUsage.__table__.create(engine, checkfirst=True)

    print("Database cleared and reinitialized.")
