"""
Letterboxd list synchronization to Plex collections.

This module scrapes Letterboxd lists and syncs them to Plex collections.
Similar to trakt_sync.py but using web scraping instead of API calls.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple

import logging

from plexapi.server import PlexServer
from plexapi.exceptions import NotFound
from homescreen_hero.core.db.models import LetterboxdMissingItem
from homescreen_hero.core.config.schema import AppConfig, LetterboxdSource
from homescreen_hero.core.integrations.letterboxd_scraper import get_letterboxd_scraper

logger = logging.getLogger(__name__)


def _find_movie_in_library(
    library,
    title: str,
    year: int | None,
):
    """
    Try to find a movie in a Plex library by title and year.

    Since Letterboxd scraping doesn't give us TMDb/IMDb IDs directly,
    we rely on title/year matching.

    Args:
        library: Plex library section
        title: Movie title
        year: Release year (optional)

    Returns:
        Plex movie item if found, None otherwise
    """
    # Search by title and year if available
    if year:
        results = library.search(title=title, year=year)
    else:
        results = library.search(title=title)

    if results:
        return results[0]

    return None


def sync_single_letterboxd_source(
    server: PlexServer,
    config: AppConfig,
    source: LetterboxdSource,
) -> Tuple[int, int]:
    """
    Sync a single Letterboxd list to a Plex collection.

    Args:
        server: PlexServer instance
        config: Application configuration
        source: LetterboxdSource configuration

    Returns:
        Tuple of (total_items, matched_items)
    """
    logger.info("Syncing Letterboxd source %s from %s", source.name, source.url)

    # Check for missing plex_library
    if not source.plex_library:
        logger.warning(
            "Letterboxd source '%s' (%s) has no plex_library set; skipping",
            source.name,
            source.url,
        )
        return 0, 0

    # Attempt to resolve the Plex library; log and skip on failure
    try:
        library = server.library.section(source.plex_library)
    except NotFound:
        try:
            available = ", ".join(sec.title for sec in server.library.sections())
        except Exception:
            available = "unknown (failed to list libraries)"

        logger.error(
            "Letterboxd source '%s' (%s) references unknown Plex library '%s'. "
            "Available libraries: %s. Skipping this source.",
            source.name,
            source.url,
            source.plex_library,
            available,
        )
        return 0, 0
    except Exception as exc:
        logger.error(
            "Unexpected error looking up Plex library '%s' for Letterboxd source '%s': %s. Skipping.",
            source.plex_library,
            source.name,
            exc,
        )
        return 0, 0

    # Scrape the Letterboxd list
    scraper = get_letterboxd_scraper()
    try:
        movies = scraper.get_list_movies(source.url)
    except Exception as exc:
        logger.error(
            "Failed to scrape Letterboxd list '%s' (%s): %s. Skipping.",
            source.name,
            source.url,
            exc,
        )
        return 0, 0

    # Get existing collection items
    existing_collection_items = []
    try:
        existing_collection_items = library.collection(source.name).items()
    except Exception:
        existing_collection_items = []

    existing_ids = {item.ratingKey for item in existing_collection_items}

    matched_items = []
    missing_items: List[Dict[str, Any]] = []

    for movie in movies:
        plex_item = _find_movie_in_library(library, movie.title, movie.year)

        if plex_item is not None:
            matched_items.append(plex_item)
        else:
            missing_items.append(
                {
                    "title": movie.title,
                    "year": movie.year,
                    "slug": movie.slug,
                    "letterboxd_url": movie.letterboxd_url,
                }
            )

    # Add matched items to the collection
    for plex_item in matched_items:
        # Create collection if it doesn't exist
        plex_item.addCollection(source.name)

    new_keys = {item.ratingKey for item in matched_items}
    to_remove_keys = existing_ids - new_keys

    for old_item in existing_collection_items:
        if old_item.ratingKey in to_remove_keys:
            try:
                old_item.removeCollection(source.name)
            except Exception:
                logger.warning(
                    "Failed to remove %s from collection %s",
                    old_item.title,
                    source.name,
                )

    total = len(movies)
    matched = len(matched_items)
    missing = len(missing_items)

    logger.info(
        "Letterboxd source '%s': total %d, matched %d, missing %d",
        source.name,
        total,
        matched,
        missing,
    )

    # Log missing items
    if missing_items:
        for m in missing_items:
            logger.info(
                "Letterboxd missing in Plex: %s (%s) slug=%s",
                m.get("title"),
                m.get("year"),
                m.get("slug"),
            )

    # Persist missing items in the database
    record_missing_items_in_db(source, missing_items)

    return total, matched


def sync_all_letterboxd_sources(
    server: PlexServer,
    config: AppConfig,
) -> None:
    """
    Sync all configured Letterboxd lists to Plex collections.

    Args:
        server: PlexServer instance
        config: Application configuration
    """
    if not config.letterboxd or not config.letterboxd.enabled:
        logger.info("Letterboxd disabled or not configured; skipping Letterboxd sync")
        return

    if not config.letterboxd.sources:
        logger.info("No Letterboxd sources configured; skipping Letterboxd sync")
        return

    logger.info("Starting Letterboxd sync for %d sources", len(config.letterboxd.sources))

    for source in config.letterboxd.sources:
        try:
            sync_single_letterboxd_source(server, config, source)
        except Exception as exc:
            logger.error(
                "Error syncing Letterboxd source '%s' (%s): %s",
                source.name,
                source.url,
                exc,
                exc_info=True,
            )

    logger.info("Letterboxd sync complete")


def record_missing_items_in_db(
    source: LetterboxdSource,
    missing_items: List[Dict[str, Any]],
) -> None:
    """
    Record missing items in the database for tracking.

    Args:
        source: LetterboxdSource configuration
        missing_items: List of movies not found in Plex
    """
    from homescreen_hero.core.db import get_session

    with get_session() as session:
        now = datetime.utcnow()

        for item in missing_items:
            title = item.get("title")
            year = item.get("year")
            slug = item.get("slug")
            letterboxd_url = item.get("letterboxd_url")

            if not title or not slug:
                continue

            # Check if this item already exists
            existing = (
                session.query(LetterboxdMissingItem)
                .filter(
                    LetterboxdMissingItem.source_name == source.name,
                    LetterboxdMissingItem.slug == slug,
                )
                .first()
            )

            if existing:
                # Update existing record
                existing.last_seen = now
                existing.times_seen += 1
                # Update fields in case they changed
                existing.title = title
                existing.year = year
                existing.letterboxd_url = letterboxd_url
            else:
                # Create new record
                new_item = LetterboxdMissingItem(
                    source_name=source.name,
                    source_url=source.url,
                    plex_library=source.plex_library,
                    plex_collection=source.name,
                    title=title,
                    year=year,
                    slug=slug,
                    letterboxd_url=letterboxd_url,
                    first_seen=now,
                    last_seen=now,
                    times_seen=1,
                )
                session.add(new_item)

        session.commit()
