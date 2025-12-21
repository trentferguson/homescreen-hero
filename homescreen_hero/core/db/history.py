from __future__ import annotations

from datetime import datetime
import logging
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .base import get_engine, session_scope
from .models import RotationRecord, CollectionUsage

logger = logging.getLogger(__name__)


def init_db() -> None:
    from . import Base

    engine = get_engine()
    logger.debug("Ensuring database schema is initialized")
    Base.metadata.create_all(bind=engine)


def record_rotation(
    featured_collections: Iterable[str],
    success: bool = True,
    error_message: Optional[str] = None,
) -> int:
    # Create a new RotationRecord and update CollectionUsage
    featured_list = list(featured_collections)
    now = datetime.utcnow()

    with session_scope() as db:
        record = RotationRecord(
            success=success,
            error_message=error_message,
            featured_collections=featured_list,
        )
        db.add(record)
        db.flush()  # Ensure record.id is populated

        rotation_id = record.id

        logger.info(
            "Recording rotation %d: featured_collections=%s",
            rotation_id,
            featured_list,
        )

        for name in featured_list:
            _update_collection_usage(db, name, rotation_id, now)
            logger.info("Updated usage for collection: %s", name)

        return rotation_id


def _update_collection_usage(
    db: Session,
    collection_name: str,
    rotation_id: int,
    when: datetime,
) -> None:
    stmt = select(CollectionUsage).where(
        CollectionUsage.collection_name == collection_name
    )
    usage = db.execute(stmt).scalar_one_or_none()

    if usage is None:
        usage = CollectionUsage(
            collection_name=collection_name,
            last_rotation_id=rotation_id,
            last_rotated_at=when,
            times_used=1,
        )
        db.add(usage)
    else:
        usage.last_rotation_id = rotation_id
        usage.last_rotated_at = when
        usage.times_used += 1


def get_rotation_history_context() -> Tuple[int, Dict[str, CollectionUsage]]:
    # Returns:
    #   - max_rotation_id (0 if no rotations yet)
    #   - dict mapping collection_name -> CollectionUsage
    with session_scope() as db:
        # Get the latest rotation id
        max_id_stmt = select(func.max(RotationRecord.id))
        max_id = db.execute(max_id_stmt).scalar()
        if max_id is None:
            max_id = 0

        logger.debug("Loaded max rotation id: %d", max_id)

        # Load all usage rows into a dict
        usage_stmt = select(CollectionUsage)
        rows = db.execute(usage_stmt).scalars().all()

        usage_map: Dict[str, CollectionUsage] = {u.collection_name: u for u in rows}

        logger.debug("Loaded usage context for %d collections", len(usage_map))
        
        return max_id, usage_map


def get_recent_rotations(limit: int = 10) -> List[RotationRecord]:
    # Utility to inspect recent rotations
    with session_scope() as db:
        stmt = (
            select(RotationRecord)
            .order_by(RotationRecord.created_at.desc())
            .limit(limit)
        )
        rows = db.execute(stmt).scalars().all()
        return list(rows)
