from __future__ import annotations

from datetime import datetime
import logging
from typing import Dict, List, Optional, Set

from sqlalchemy import func, select

from .base import session_scope
from .models import CollectionDisplayOrder, PinnedCollection

logger = logging.getLogger(__name__)


def get_pinned_collections() -> List[PinnedCollection]:
    # Return all pinned collections ordered by display_order
    with session_scope() as db:
        stmt = select(PinnedCollection).order_by(PinnedCollection.display_order.asc())
        rows = db.execute(stmt).scalars().all()
        return list(rows)


def get_pinned_collection_names() -> Set[str]:
    # Return just the names of pinned collections
    with session_scope() as db:
        stmt = select(PinnedCollection.collection_name)
        rows = db.execute(stmt).scalars().all()
        return set(rows)


def is_collection_pinned(collection_name: str) -> bool:
    # Check if a specific collection is pinned
    with session_scope() as db:
        stmt = select(PinnedCollection).where(
            PinnedCollection.collection_name == collection_name
        )
        result = db.execute(stmt).scalar_one_or_none()
        return result is not None


def pin_collection(
    collection_name: str,
    library_name: str,
    display_order: Optional[int] = None,
) -> PinnedCollection:
    # Pin a collection. If already pinned, update the library/order.
    with session_scope() as db:
        stmt = select(PinnedCollection).where(
            PinnedCollection.collection_name == collection_name
        )
        existing = db.execute(stmt).scalar_one_or_none()

        if existing is not None:
            existing.library_name = library_name
            if display_order is not None:
                existing.display_order = display_order
            logger.info("Updated pin for collection: %s", collection_name)
            return existing

        if display_order is None:
            max_order_stmt = select(func.max(PinnedCollection.display_order))
            max_order = db.execute(max_order_stmt).scalar()
            display_order = (max_order or 0) + 1

        pinned = PinnedCollection(
            collection_name=collection_name,
            library_name=library_name,
            display_order=display_order,
            pinned_at=datetime.utcnow(),
        )
        db.add(pinned)
        logger.info("Pinned collection: %s (order=%d)", collection_name, display_order)
        return pinned


def unpin_collection(collection_name: str) -> bool:
    # Unpin a collection. Returns True if it was pinned, False otherwise.
    with session_scope() as db:
        stmt = select(PinnedCollection).where(
            PinnedCollection.collection_name == collection_name
        )
        existing = db.execute(stmt).scalar_one_or_none()

        if existing is None:
            return False

        db.delete(existing)
        logger.info("Unpinned collection: %s", collection_name)
        return True


def get_display_order() -> Dict[str, int]:
    # Get display order for all tracked collections
    with session_scope() as db:
        result: Dict[str, int] = {}

        # Pinned collections first
        pinned_stmt = select(PinnedCollection).order_by(
            PinnedCollection.display_order.asc()
        )
        pinned_rows = db.execute(pinned_stmt).scalars().all()
        for row in pinned_rows:
            result[row.collection_name] = row.display_order

        # Regular display order
        order_stmt = select(CollectionDisplayOrder).order_by(
            CollectionDisplayOrder.display_order.asc()
        )
        order_rows = db.execute(order_stmt).scalars().all()
        for row in order_rows:
            if row.collection_name not in result:
                result[row.collection_name] = row.display_order + 10000

        return result


def update_display_order(ordered_names: List[str]) -> None:
    # Update the display order for a list of collection names
    with session_scope() as db:
        now = datetime.utcnow()

        for idx, name in enumerate(ordered_names):
            stmt = select(CollectionDisplayOrder).where(
                CollectionDisplayOrder.collection_name == name
            )
            existing = db.execute(stmt).scalar_one_or_none()

            if existing is not None:
                existing.display_order = idx
                existing.updated_at = now
            else:
                order = CollectionDisplayOrder(
                    collection_name=name,
                    display_order=idx,
                    updated_at=now,
                )
                db.add(order)

        logger.info("Updated display order for %d collections", len(ordered_names))
