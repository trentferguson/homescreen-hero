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

    # Run schema migrations for existing tables
    _migrate_collection_analytics(engine)
    _migrate_pinned_collections_visibility(engine)
    _migrate_users_status(engine)
    _migrate_seerr_auto_requests_downloaded_at(engine)
    _migrate_letterboxd_missing_items_tmdb_id(engine)


def _migrate_collection_analytics(engine) -> None:
    # Add media_type column to collection_analytics if it doesn't exist
    # This handles the case where the table was created before the column was added
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    # Check if table exists
    if "collection_analytics" not in inspector.get_table_names():
        return

    # Check if column already exists
    columns = [col["name"] for col in inspector.get_columns("collection_analytics")]
    if "media_type" in columns:
        return

    logger.info("Migrating collection_analytics: adding media_type column")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE collection_analytics ADD COLUMN media_type VARCHAR"))
        conn.commit()


def _migrate_pinned_collections_visibility(engine) -> None:
    # Add visibility columns to pinned_collections if they don't exist
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    # Check if table exists
    if "pinned_collections" not in inspector.get_table_names():
        return

    # Check which columns need to be added
    columns = [col["name"] for col in inspector.get_columns("pinned_collections")]
    columns_to_add = []

    if "visibility_home" not in columns:
        columns_to_add.append(("visibility_home", "BOOLEAN", "1"))  # default True
    if "visibility_shared" not in columns:
        columns_to_add.append(("visibility_shared", "BOOLEAN", "0"))  # default False
    if "visibility_recommended" not in columns:
        columns_to_add.append(("visibility_recommended", "BOOLEAN", "0"))  # default False

    if not columns_to_add:
        return

    logger.info("Migrating pinned_collections: adding visibility columns")
    with engine.connect() as conn:
        for col_name, col_type, default_val in columns_to_add:
            conn.execute(text(f"ALTER TABLE pinned_collections ADD COLUMN {col_name} {col_type} NOT NULL DEFAULT {default_val}"))
        conn.commit()


def _migrate_users_status(engine) -> None:
    # Add status column to users table if it doesn't exist
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        return

    columns = [col["name"] for col in inspector.get_columns("users")]
    if "status" in columns:
        return

    logger.info("Migrating users: adding status column")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR NOT NULL DEFAULT 'approved'"))
        conn.commit()


def _migrate_seerr_auto_requests_downloaded_at(engine) -> None:
    # Add downloaded_at column to seerr_auto_requests if it doesn't exist
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    if "seerr_auto_requests" not in inspector.get_table_names():
        return

    columns = [col["name"] for col in inspector.get_columns("seerr_auto_requests")]
    if "downloaded_at" in columns:
        return

    logger.info("Migrating seerr_auto_requests: adding downloaded_at column")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE seerr_auto_requests ADD COLUMN downloaded_at DATETIME"))
        conn.commit()


def _migrate_letterboxd_missing_items_tmdb_id(engine) -> None:
    # Add tmdb_id column to letterboxd_missing_items if it doesn't exist
    from sqlalchemy import text, inspect

    inspector = inspect(engine)

    if "letterboxd_missing_items" not in inspector.get_table_names():
        return

    columns = [col["name"] for col in inspector.get_columns("letterboxd_missing_items")]
    if "tmdb_id" in columns:
        return

    logger.info("Migrating letterboxd_missing_items: adding tmdb_id column")
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE letterboxd_missing_items ADD COLUMN tmdb_id INTEGER"))
        conn.commit()


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


def get_last_rotation_collections() -> List[str]:
    # Get the collections from the most recent rotation (for allow_repeats logic)
    with session_scope() as db:
        stmt = (
            select(RotationRecord)
            .order_by(RotationRecord.id.desc())
            .limit(1)
        )
        record = db.execute(stmt).scalar_one_or_none()
        if record is None:
            return []
        return list(record.featured_collections or [])
