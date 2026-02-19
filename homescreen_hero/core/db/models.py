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


class LetterboxdMissingItem(Base):
    __tablename__ = "letterboxd_missing_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which Letterboxd source this came from
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)

    # Where we expected to find it in Plex
    plex_library: Mapped[str] = mapped_column(String, nullable=False)
    plex_collection: Mapped[str] = mapped_column(String, nullable=False)

    # Movie identity
    title: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Letterboxd identifiers
    slug: Mapped[str] = mapped_column(String, nullable=False)
    letterboxd_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Tracking
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    times_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class MDBListMissingItem(Base):
    __tablename__ = "mdblist_missing_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which MDBList source this came from
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)

    # Where we expected to find it in Plex
    plex_library: Mapped[str] = mapped_column(String, nullable=False)
    plex_collection: Mapped[str] = mapped_column(String, nullable=False)

    # Movie identity
    title: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # MDBList / external IDs (nullable if not present)
    imdb_id: Mapped[str | None] = mapped_column(String, nullable=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trakt_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mdblist_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Tracking
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    times_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class AniListMissingItem(Base):
    __tablename__ = "anilist_missing_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which AniList source this came from
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)

    # Where we expected to find it in Plex
    plex_library: Mapped[str] = mapped_column(String, nullable=False)
    plex_collection: Mapped[str] = mapped_column(String, nullable=False)

    # Media identity
    title: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    media_format: Mapped[str | None] = mapped_column(String, nullable=True)

    # AniList / MAL IDs
    anilist_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Mapped IDs (from anime-lists)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(String, nullable=True)
    tvdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Tracking
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    times_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class MALMissingItem(Base):
    __tablename__ = "mal_missing_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Which MAL source this came from
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)

    # Where we expected to find it in Plex
    plex_library: Mapped[str] = mapped_column(String, nullable=False)
    plex_collection: Mapped[str] = mapped_column(String, nullable=False)

    # Media identity
    title: Mapped[str] = mapped_column(String, nullable=False)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    media_type: Mapped[str | None] = mapped_column(String, nullable=True)

    # MAL ID
    mal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Mapped IDs (from anime-lists)
    anilist_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(String, nullable=True)
    tvdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Tracking
    first_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    last_seen: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    times_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class CollectionAnalytics(Base):
    # Analytics snapshots for collection watch statistics from Tautulli
    __tablename__ = "collection_analytics"

    id = Column(Integer, primary_key=True, index=True)

    # Collection identification
    collection_name = Column(String, nullable=False, index=True)
    plex_library = Column(String, nullable=False)
    rating_key = Column(Integer, nullable=True)

    # Media type derived from Plex library type ("movie" or "show")
    # This allows filtering by media type regardless of library naming
    media_type = Column(String, nullable=True, index=True)

    # Analytics data from Tautulli
    total_plays = Column(Integer, nullable=False, default=0)
    total_duration_seconds = Column(Integer, nullable=True)
    unique_users = Column(Integer, nullable=True)

    # Link to rotation (for "after rotation" snapshots)
    rotation_id = Column(Integer, nullable=True, index=True)

    # Timestamps
    collected_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    # Optional extra data (JSON for flexibility - can store additional stats)
    extra_data = Column(JSON, nullable=True)


class PinnedCollection(Base):
    # Collections permanently pinned to the homescreen (don't count against max_collections)
    __tablename__ = "pinned_collections"

    id = Column(Integer, primary_key=True, index=True)
    collection_name = Column(String, nullable=False, unique=True, index=True)
    library_name = Column(String, nullable=False)
    display_order = Column(Integer, nullable=False, default=0, index=True)
    pinned_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    # Visibility settings - what screens this collection should appear on
    visibility_home = Column(Boolean, nullable=False, default=True)
    visibility_shared = Column(Boolean, nullable=False, default=False)
    visibility_recommended = Column(Boolean, nullable=False, default=False)


class SourceSyncRecord(Base):
    # Tracks the latest sync result for each integration source
    __tablename__ = "source_sync_records"

    id = Column(Integer, primary_key=True, index=True)
    integration_type = Column(String, nullable=False, index=True)  # trakt, letterboxd, mdblist, anilist
    source_name = Column(String, nullable=False, index=True)
    source_url = Column(String, nullable=False)

    sync_status = Column(String, nullable=False, default="never_synced")  # success, error, never_synced
    last_sync_time = Column(DateTime, nullable=True)
    items_total = Column(Integer, nullable=False, default=0)
    items_matched = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Plex identity (nullable for password-only admin)
    plex_id = Column(Integer, nullable=True, unique=True, index=True)
    plex_username = Column(String, nullable=True)
    plex_email = Column(String, nullable=True)
    plex_thumb = Column(String, nullable=True)

    # "admin" or "user"
    role = Column(String, nullable=False, default="user")

    # "approved" or "pending"
    status = Column(String, nullable=False, default="approved")

    # For password-auth fallback (only admin uses this)
    password_hash = Column(String, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)


class CollectionDisplayOrder(Base):
    # Tracks the display order of active collections on the homescreen
    __tablename__ = "collection_display_order"

    id = Column(Integer, primary_key=True, index=True)
    collection_name = Column(String, nullable=False, unique=True, index=True)
    display_order = Column(Integer, nullable=False, default=0, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
