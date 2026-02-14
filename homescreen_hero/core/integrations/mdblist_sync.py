from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple

import logging

from plexapi.server import PlexServer
from plexapi.exceptions import NotFound
from homescreen_hero.core.db.models import MDBListMissingItem
from homescreen_hero.core.config.schema import AppConfig, MDBListSource
from homescreen_hero.core.integrations.mdblist_client import get_mdblist_client
from homescreen_hero.core.integrations.plex_match import build_guid_map, find_movie

logger = logging.getLogger(__name__)


def sync_single_mdblist_source(
    server: PlexServer,
    config: AppConfig,
    source: MDBListSource,
) -> Tuple[int, int]:
    # Returns (total_items, matched_items)
    mdblist_client = get_mdblist_client(config)
    if mdblist_client is None:
        logger.info("MDBList client not available; skipping source %s from %s", source.name, source.url)
        return 0, 0

    logger.info("Syncing MDBList source %s from %s", source.name, source.url)

    # Check for missing plex_library
    if not source.plex_library:
        logger.warning(
            "MDBList source '%s' (%s) has no plex_library set; skipping",
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
            "MDBList source '%s' (%s) references unknown Plex library '%s'. "
            "Available libraries: %s. Skipping this source.",
            source.name,
            source.url,
            source.plex_library,
            available,
        )
        return 0, 0
    except Exception as exc:
        logger.error(
            "Unexpected error looking up Plex library '%s' for MDBList source '%s': %s. Skipping.",
            source.plex_library,
            source.name,
            exc,
        )
        return 0, 0

    # Fetch items from MDBList
    try:
        items = mdblist_client.get_list_items(source.url)
    except Exception as exc:
        logger.error(
            "Failed to fetch MDBList items from %s: %s",
            source.url,
            exc,
        )
        return 0, 0

    # Build GUID lookup map once for fast matching
    logger.info("Building Plex library GUID index for '%s'...", source.plex_library)
    guid_map = build_guid_map(library)

    existing_collection_items = []
    try:
        existing_collection_items = library.collection(source.name).items()
    except Exception:
        existing_collection_items = []

    existing_ids = {item.ratingKey for item in existing_collection_items}

    matched_items = []
    missing_items: List[Dict[str, Any]] = []

    for item in items:
        title = item.title
        year = item.year
        imdb_id = item.imdb_id
        tmdb_id = item.tmdb_id
        trakt_id = item.trakt_id
        mdblist_id = item.mdblist_id

        if not title:
            continue

        plex_item = find_movie(guid_map, library, title, year, imdb_id, tmdb_id)

        if plex_item is not None:
            matched_items.append(plex_item)
        else:
            missing_items.append(
                {
                    "title": title,
                    "year": year,
                    "imdb_id": imdb_id,
                    "tmdb_id": tmdb_id,
                    "trakt_id": trakt_id,
                    "mdblist_id": mdblist_id,
                }
            )

    # Add matched items to the collection
    for plex_item in matched_items:
        # Create collection if it doesn't exist
        plex_item.addCollection(source.name)

    # Only remove items if we successfully fetched items from MDBList
    # This prevents wiping collections on network errors or API failures
    if items:
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
    else:
        logger.warning(
            "MDBList source '%s' returned no items - skipping removal to prevent data loss. "
            "This could indicate a network error or API failure.",
            source.name,
        )

    total = len(items)
    matched = len(matched_items)
    missing = len(missing_items)

    logger.info(
        "MDBList source '%s': total %d, matched %d, missing %d",
        source.name,
        total,
        matched,
        missing,
    )

    # Logs missing item from MDBList Collection
    # Future plan: automatically send requests to Sonarr/Radarr to add them
    if missing_items:
        for m in missing_items:
            logger.info(
                "MDBList missing in Plex: %s (%s) imdb=%s tmdb=%s",
                m.get("title"),
                m.get("year"),
                m.get("imdb_id"),
                m.get("tmdb_id"),
            )

    # Also persist them in the database
    record_missing_items_in_db(source, missing_items)

    return total, matched


def sync_all_mdblist_sources(
    server: PlexServer,
    config: AppConfig,
) -> None:
    if not config.mdblist or not config.mdblist.enabled:
        logger.info("MDBList disabled or not configured; skipping MDBList sync")
        return

    if not config.mdblist.sources:
        logger.info("No MDBList sources configured; skipping MDBList sync")
        return

    for source in config.mdblist.sources:
        sync_single_mdblist_source(server, config, source)


def record_missing_items_in_db(
    source: MDBListSource,
    missing_items: list[dict[str, any]],
) -> None:
    # Store/update records for MDBList titles that weren't found in Plex library
    if not missing_items:
        return

    from homescreen_hero.core.db import get_session

    with get_session() as session:
        for m in missing_items:
            imdb_id = m.get("imdb_id")
            tmdb_id = m.get("tmdb_id")
            trakt_id = m.get("trakt_id")
            mdblist_id = m.get("mdblist_id")

            title = m.get("title")
            year = m.get("year")

            # Try to find an existing record for this source + title + IDs
            query = session.query(MDBListMissingItem).filter(
                MDBListMissingItem.source_name == source.name,
                MDBListMissingItem.source_url == source.url,
                MDBListMissingItem.title == title,
                MDBListMissingItem.year == year,
            )

            # Add ID filters if available
            if imdb_id:
                query = query.filter(MDBListMissingItem.imdb_id == imdb_id)
            if tmdb_id:
                query = query.filter(MDBListMissingItem.tmdb_id == tmdb_id)

            existing = query.first()

            if existing:
                existing.last_seen = datetime.utcnow()
                existing.times_seen += 1
            else:
                row = MDBListMissingItem(
                    source_name=source.name,
                    source_url=source.url,
                    plex_library=source.plex_library,
                    plex_collection=source.name,
                    title=title,
                    year=year,
                    imdb_id=imdb_id,
                    tmdb_id=tmdb_id,
                    trakt_id=trakt_id,
                    mdblist_id=mdblist_id,
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    times_seen=1,
                )
                session.add(row)

        session.commit()
