"""
Seed demo database with sample rotation history and usage stats.
For use in demo/testing environments.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List
from sqlalchemy.orm import Session

from .models import RotationRecord, CollectionUsage

logger = logging.getLogger(__name__)


def seed_demo_rotation_history(session: Session) -> None:
    """Seed the database with sample rotation history."""

    # Sample collections from our mock data
    all_collections = [
        "Oscar Winners 2024",
        "80s Action Classics",
        "Criterion Collection",
        "Studio Ghibli Films",
        "Nolan Collection",
        "90s Crime Dramas",
        "Best Picture Winners",
        "Sci-Fi Essentials",
        "HBO Prestige Dramas",
        "90s Sitcoms",
        "Modern Comedy Classics",
        "British Comedy",
        "Anime Classics",
    ]

    # Check if we already have data
    existing_count = session.query(RotationRecord).count()
    if existing_count > 0:
        logger.info("Demo data already exists (%d records). Skipping seed.", existing_count)
        return

    logger.info("Seeding demo rotation history...")

    # Create 15 sample rotations over the past 30 days
    num_rotations = 15
    base_date = datetime.now() - timedelta(days=30)

    rotation_patterns = [
        ["Oscar Winners 2024", "80s Action Classics", "HBO Prestige Dramas"],
        ["Criterion Collection", "Studio Ghibli Films", "90s Sitcoms"],
        ["Nolan Collection", "Sci-Fi Essentials", "Anime Classics"],
        ["Best Picture Winners", "Modern Comedy Classics", "British Comedy"],
        ["90s Crime Dramas", "HBO Prestige Dramas", "Studio Ghibli Films"],
        ["Oscar Winners 2024", "Nolan Collection", "90s Sitcoms"],
        ["80s Action Classics", "Criterion Collection", "Anime Classics"],
        ["Sci-Fi Essentials", "Best Picture Winners", "British Comedy"],
        ["Studio Ghibli Films", "90s Crime Dramas", "Modern Comedy Classics"],
        ["HBO Prestige Dramas", "Nolan Collection", "Oscar Winners 2024"],
        ["Anime Classics", "80s Action Classics", "90s Sitcoms"],
        ["British Comedy", "Criterion Collection", "Sci-Fi Essentials"],
        ["Modern Comedy Classics", "Best Picture Winners", "Studio Ghibli Films"],
        ["90s Crime Dramas", "Oscar Winners 2024", "Anime Classics"],
        ["Nolan Collection", "HBO Prestige Dramas", "80s Action Classics"],
    ]

    for rotation_id in range(1, num_rotations + 1):
        # Calculate timestamp (every ~2 days)
        rotation_date = base_date + timedelta(days=(rotation_id - 1) * 2, hours=(rotation_id * 3) % 24)

        # Get collections for this rotation
        collections = rotation_patterns[rotation_id - 1]

        # Create rotation records
        for collection_name in collections:
            record = RotationRecord(
                rotation_id=rotation_id,
                collection_name=collection_name,
                created_at=rotation_date,
                success=True,
                error_message=None,
            )
            session.add(record)

        logger.debug(
            "Created rotation %d at %s with collections: %s",
            rotation_id,
            rotation_date.isoformat(),
            ", ".join(collections)
        )

    session.commit()
    logger.info("Created %d rotation records across %d rotations", len(rotation_patterns) * 3, num_rotations)

    # Now create collection usage stats
    seed_demo_collection_usage(session, all_collections, num_rotations)


def seed_demo_collection_usage(
    session: Session,
    all_collections: List[str],
    last_rotation_id: int
) -> None:
    """Seed collection usage statistics."""

    logger.info("Seeding demo collection usage stats...")

    # Count how many times each collection was used
    usage_counts = {}
    for record in session.query(RotationRecord).all():
        collection = record.collection_name
        if collection not in usage_counts:
            usage_counts[collection] = {
                "count": 0,
                "last_rotation": record.rotation_id,
            }
        usage_counts[collection]["count"] += 1
        if record.rotation_id > usage_counts[collection]["last_rotation"]:
            usage_counts[collection]["last_rotation"] = record.rotation_id

    # Create usage records
    for collection_name in all_collections:
        if collection_name in usage_counts:
            usage = CollectionUsage(
                collection_name=collection_name,
                times_used=usage_counts[collection_name]["count"],
                last_rotation_id=usage_counts[collection_name]["last_rotation"],
                updated_at=datetime.now(),
            )
        else:
            # Collection never used
            usage = CollectionUsage(
                collection_name=collection_name,
                times_used=0,
                last_rotation_id=0,
                updated_at=datetime.now(),
            )

        session.add(usage)
        logger.debug(
            "Collection '%s': used %d times, last rotation %d",
            collection_name,
            usage.times_used,
            usage.last_rotation_id
        )

    session.commit()
    logger.info("Created usage stats for %d collections", len(all_collections))


def clear_demo_data(session: Session) -> None:
    """Clear all demo data from the database."""

    logger.warning("Clearing all demo data...")

    # Delete all records
    session.query(RotationRecord).delete()
    session.query(CollectionUsage).delete()

    session.commit()
    logger.info("Demo data cleared")
