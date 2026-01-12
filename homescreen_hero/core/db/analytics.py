from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from sqlalchemy import desc, func

from .base import get_session
from .models import CollectionAnalytics

logger = logging.getLogger(__name__)


def record_collection_analytics(
    collection_name: str,
    plex_library: str,
    rating_key: Optional[int],
    total_plays: int,
    total_duration_seconds: Optional[int] = None,
    unique_users: Optional[int] = None,
    rotation_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> CollectionAnalytics:
    """
    Record a new analytics snapshot for a collection.

    Args:
        collection_name: Name of the Plex collection
        plex_library: Name of the Plex library containing the collection
        rating_key: Plex rating key for the collection
        total_plays: Total number of plays from Tautulli
        total_duration_seconds: Total watch duration in seconds
        unique_users: Number of unique users who watched
        rotation_id: Optional rotation ID this snapshot is associated with
        metadata: Optional additional metadata (JSON)

    Returns:
        The created CollectionAnalytics record
    """
    with get_session() as session:
        record = CollectionAnalytics(
            collection_name=collection_name,
            plex_library=plex_library,
            rating_key=rating_key,
            total_plays=total_plays,
            total_duration_seconds=total_duration_seconds,
            unique_users=unique_users,
            rotation_id=rotation_id,
            collected_at=datetime.utcnow(),
            metadata=metadata,
        )
        session.add(record)
        session.commit()
        session.refresh(record)

        logger.info(
            "Recorded analytics for '%s': %d plays",
            collection_name,
            total_plays,
        )

        return record


def get_collection_analytics_history(
    collection_name: Optional[str] = None,
    limit: int = 50,
) -> List[CollectionAnalytics]:
    """
    Get analytics history, optionally filtered by collection.

    Args:
        collection_name: Optional collection name to filter by
        limit: Maximum number of records to return

    Returns:
        List of CollectionAnalytics records, ordered by collected_at DESC
    """
    with get_session() as session:
        query = session.query(CollectionAnalytics)

        if collection_name:
            query = query.filter(CollectionAnalytics.collection_name == collection_name)

        query = query.order_by(desc(CollectionAnalytics.collected_at))
        query = query.limit(limit)

        return list(query.all())


def get_top_collections_by_plays(
    limit: int = 10,
    since_rotation_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Get top performing collections by play count.

    Args:
        limit: Maximum number of collections to return
        since_rotation_id: Optional rotation ID to filter records from

    Returns:
        List of dicts with collection info and aggregated play counts
    """
    with get_session() as session:
        # Build query to get most recent snapshot for each collection
        subquery = (
            session.query(
                CollectionAnalytics.collection_name,
                func.max(CollectionAnalytics.collected_at).label("max_collected_at"),
            )
            .group_by(CollectionAnalytics.collection_name)
        )

        if since_rotation_id:
            subquery = subquery.filter(CollectionAnalytics.rotation_id >= since_rotation_id)

        subquery = subquery.subquery()

        # Join to get full records for most recent snapshots
        query = (
            session.query(CollectionAnalytics)
            .join(
                subquery,
                (CollectionAnalytics.collection_name == subquery.c.collection_name)
                & (CollectionAnalytics.collected_at == subquery.c.max_collected_at),
            )
            .order_by(desc(CollectionAnalytics.total_plays))
            .limit(limit)
        )

        results = []
        for record in query.all():
            results.append(
                {
                    "collection_name": record.collection_name,
                    "total_plays": record.total_plays,
                    "plex_library": record.plex_library,
                    "last_collected": record.collected_at,
                    "rotation_id": record.rotation_id,
                }
            )

        return results


def get_rotation_analytics(rotation_id: int) -> List[CollectionAnalytics]:
    """
    Get all analytics snapshots for a specific rotation.

    Args:
        rotation_id: The rotation ID to fetch analytics for

    Returns:
        List of CollectionAnalytics records for the rotation
    """
    with get_session() as session:
        query = session.query(CollectionAnalytics)
        query = query.filter(CollectionAnalytics.rotation_id == rotation_id)
        query = query.order_by(desc(CollectionAnalytics.total_plays))

        return list(query.all())


def get_latest_analytics_for_collection(collection_name: str) -> Optional[CollectionAnalytics]:
    """
    Get the most recent analytics snapshot for a specific collection.

    Args:
        collection_name: Name of the collection

    Returns:
        The latest CollectionAnalytics record, or None if not found
    """
    with get_session() as session:
        query = session.query(CollectionAnalytics)
        query = query.filter(CollectionAnalytics.collection_name == collection_name)
        query = query.order_by(desc(CollectionAnalytics.collected_at))
        query = query.limit(1)

        return query.first()
