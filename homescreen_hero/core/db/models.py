from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    JSON,
)

from .base import Base


class RotationRecord(Base):
    # A record of a single rotation run
    __tablename__ = "rotation_records"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)

    # List of collection names featured in this rotation
    featured_collections = Column(JSON, nullable=False)


class CollectionUsage(Base):
    # Tracks how often each collection has been used and in which rotation
    __tablename__ = "collection_usage"

    id = Column(Integer, primary_key=True, index=True)
    collection_name = Column(String, nullable=False, unique=True, index=True)

    last_rotation_id = Column(Integer, nullable=True)
    last_rotated_at = Column(DateTime, nullable=True)
    times_used = Column(Integer, nullable=False, default=0)


class PendingSimulation(Base):
    __tablename__ = "pending_simulations"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # The exact list of collections chosen for this simulation
    selected_collections = Column(JSON, nullable=False)

    # A snapshot of the rotation state at the time of simulation
    rotation_snapshot = Column(JSON, nullable=True)

    # Whether this simulation has been turned into a real rotation
    applied = Column(Boolean, nullable=False, default=False)
    applied_at = Column(DateTime, nullable=True)



class TraktMissingItem(Base):
    __tablename__ = "trakt_missing_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which Trakt source this came from
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)

    # Where we expected to find it in Plex
    plex_library: Mapped[str] = mapped_column(String, nullable=False)
    plex_collection: Mapped[str] = mapped_column(String, nullable=False)

    # Movie identity
    title: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[str | None] = mapped_column(Integer, nullable=True)

    # Trakt / external IDs (nullable if not present)
    trakt_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    slug: Mapped[str | None] = mapped_column(String, nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(String, nullable=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Tracking
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    times_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
