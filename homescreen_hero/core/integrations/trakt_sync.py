from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple

import logging

from plexapi.server import PlexServer
from plexapi.exceptions import NotFound
from homescreen_hero.core.db.models import TraktMissingItem
from homescreen_hero.core.config.schema import AppConfig, TraktSource
from homescreen_hero.core.integrations.trakt_client import get_trakt_client

logger = logging.getLogger(__name__)


def _find_movie_in_library(
    library,
    title: str,
    year: int | None,
    ids: Dict[str, Any],
):
    # Try to match by GUID ids (tmdb/imdb) if possible, otherwise fall back to title/year
    tmdb_id = ids.get("tmdb")
    imdb_id = ids.get("imdb")

    # 1) Try TMDb GUID
    if tmdb_id is not None:
        guid = f"com.plexapp.agents.themoviedb://{tmdb_id}?lang=en"
        results = library.search(guid=guid)
        if results:
            return results[0]

    # 2) Try IMDb GUID
    if imdb_id:
        guid = f"com.plexapp.agents.imdb://{imdb_id}?lang=en"
        results = library.search(guid=guid)
        if results:
            return results[0]

    # 3) Fallback: title/year search
    if year:
        results = library.search(title=title, year=year)
    else:
        results = library.search(title=title)

    if results:
        return results[0]

    return None


def sync_single_trakt_source(
    server: PlexServer,
    config: AppConfig,
    source: TraktSource,
) -> Tuple[int, int]:
    # Returns (total_items, matched_items)
    trakt_client = get_trakt_client(config)
    if trakt_client is None:
        logger.info("Trakt client not available; skipping source %s from %s", source.name, source.url)
        return 0, 0

        logger.info("Syncing Trakt source %s from %s", source.name, source.url)

    # Check for missing plex_library
    if not source.plex_library:
        logger.warning(
            "Trakt source '%s' (%s) has no plex_library set; skipping",
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
            "Trakt source '%s' (%s) references unknown Plex library '%s'. "
            "Available libraries: %s. Skipping this source.",
            source.name,
            source.url,
            source.plex_library,
            available,
        )
        return 0, 0
    except Exception as exc:
        logger.error(
            "Unexpected error looking up Plex library '%s' for Trakt source '%s': %s. Skipping.",
            source.plex_library,
            source.name,
            exc,
        )
        return 0, 0

    items = trakt_client.get_list_items_from_url(source.url)

    existing_collection_items = []
    try:
        existing_collection_items = library.collection(source.name).items()
    except Exception:
        existing_collection_items = []

    existing_ids = {item.ratingKey for item in existing_collection_items}

    matched_items = []
    missing_items: List[Dict[str, Any]] = []

    for item in items:
        if item.get("type") != "movie":
            continue

        movie = item.get("movie") or {}
        title = movie.get("title")
        year = movie.get("year")
        ids = movie.get("ids") or {}

        if not title:
            continue

        plex_item = _find_movie_in_library(library, title, year, ids)

        if plex_item is not None:
            matched_items.append(plex_item)
        else:
            missing_items.append(
                {
                    "title": title,
                    "year": year,
                    "ids": ids,
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

    total = len(items)
    matched = len(matched_items)
    missing = len(missing_items)

    logger.info(
        "Trakt source '%s': total %d, matched %d, missing %d",
        source.name,
        total,
        matched,
        missing,
    )

    # Logs missing item from Trakt Collection
    # Future plan: automatically send requests to Sonarr/Radarr to add them
    if missing_items:
        for m in missing_items:
            logger.info(
                "Trakt missing in Plex: %s (%s) ids=%s",
                m.get("title"),
                m.get("year"),
                m.get("ids"),
            )

    # Also persist them in the database
    record_missing_items_in_db(source, missing_items)

    return total, matched


def sync_all_trakt_sources(
    server: PlexServer,
    config: AppConfig,
) -> None:
    if not config.trakt or not config.trakt.enabled:
        logger.info("Trakt disabled or not configured; skipping Trakt sync")
        return

    if not config.trakt.sources:
        logger.info("No Trakt sources configured; skipping Trakt sync")
        return

    for source in config.trakt.sources:
        sync_single_trakt_source(server, config, source)


def record_missing_items_in_db(
    source: TraktSource,
    missing_items: list[dict[str, any]],
) -> None:
    # Store/update records for Trakt titles that weren't found in Plex library
    if not missing_items:
        return

    from homescreen_hero.core.db import get_session

    with get_session() as session:
        for m in missing_items:
            ids = m.get("ids") or {}
            trakt_id = ids.get("trakt")
            slug = ids.get("slug")
            imdb_id = ids.get("imdb")
            tmdb_id = ids.get("tmdb")

            title = m.get("title")
            year = m.get("year")

            # Try to find an existing record for this source + title + IDs
            query = session.query(TraktMissingItem).filter(
                TraktMissingItem.source_name == source.name,
                TraktMissingItem.source_url == source.url,
                TraktMissingItem.title == title,
                TraktMissingItem.year == year,
                TraktMissingItem.trakt_id == trakt_id,
            )

            existing = query.first()

            if existing:
                existing.last_seen = datetime.utcnow()
                existing.times_seen += 1
            else:
                row = TraktMissingItem(
                    source_name=source.name,
                    source_url=source.url,
                    plex_library=source.plex_library,
                    plex_collection=source.name,
                    title=title,
                    year=year,
                    trakt_id=trakt_id,
                    slug=slug,
                    imdb_id=imdb_id,
                    tmdb_id=tmdb_id,
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    times_seen=1,
                )
                session.add(row)

        session.commit()
