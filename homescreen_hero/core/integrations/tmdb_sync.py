from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple

import logging

from plexapi.server import PlexServer
from plexapi.exceptions import NotFound
from homescreen_hero.core.db.models import TMDbMissingItem
from homescreen_hero.core.db.sync_status import record_sync_result
from homescreen_hero.core.config.schema import AppConfig, TMDbSource
from homescreen_hero.core.integrations.tmdb_client import get_tmdb_client
from homescreen_hero.core.integrations.plex_match import build_guid_map, find_movie

logger = logging.getLogger(__name__)


def sync_single_tmdb_source(
    server: PlexServer,
    config: AppConfig,
    source: TMDbSource,
) -> Tuple[int, int]:
    # Returns (total_items, matched_items)
    tmdb_client = get_tmdb_client(config)
    if tmdb_client is None:
        logger.info("TMDb client not available; skipping source %s from %s", source.name, source.url)
        return 0, 0

    logger.info("Syncing TMDb source %s from %s", source.name, source.url)

    if not source.plex_library:
        logger.warning(
            "TMDb source '%s' (%s) has no plex_library set; skipping",
            source.name,
            source.url,
        )
        return 0, 0

    # Resolve the Plex library
    try:
        library = server.library.section(source.plex_library)
    except NotFound:
        try:
            available = ", ".join(sec.title for sec in server.library.sections())
        except Exception:
            available = "unknown (failed to list libraries)"

        logger.error(
            "TMDb source '%s' (%s) references unknown Plex library '%s'. "
            "Available libraries: %s. Skipping this source.",
            source.name,
            source.url,
            source.plex_library,
            available,
        )
        return 0, 0
    except Exception as exc:
        logger.error(
            "Unexpected error looking up Plex library '%s' for TMDb source '%s': %s. Skipping.",
            source.plex_library,
            source.name,
            exc,
        )
        return 0, 0

    # Fetch items from TMDb
    try:
        items = tmdb_client.get_list_items(source.url)
    except Exception as exc:
        logger.error(
            "Failed to fetch TMDb items from %s: %s",
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
    matched_tmdb_ids: set[int] = set()
    missing_items: List[Dict[str, Any]] = []

    for item in items:
        title = item.title
        year = item.year
        tmdb_id = item.tmdb_id

        if not title:
            continue

        plex_item = find_movie(guid_map, library, title, year, None, tmdb_id)

        if plex_item is not None:
            matched_items.append(plex_item)
            if tmdb_id:
                matched_tmdb_ids.add(tmdb_id)
        else:
            missing_items.append(
                {
                    "title": title,
                    "year": year,
                    "tmdb_id": tmdb_id,
                    "media_type": item.media_type,
                }
            )

    # Add matched items to the collection
    for plex_item in matched_items:
        plex_item.addCollection(source.name)

    # Only remove items if we successfully fetched items from TMDb
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
            "TMDb source '%s' returned no items - skipping removal to prevent data loss. "
            "This could indicate a network error or API failure.",
            source.name,
        )

    total = len(items)
    matched = len(matched_items)
    missing = len(missing_items)

    logger.info(
        "TMDb source '%s': total %d, matched %d, missing %d",
        source.name,
        total,
        matched,
        missing,
    )

    if missing_items:
        for m in missing_items:
            logger.debug(
                "TMDb missing in Plex: %s (%s) tmdb=%s",
                m.get("title"),
                m.get("year"),
                m.get("tmdb_id"),
            )

    # Persist missing items in the database
    if items:
        record_missing_items_in_db(source, missing_items)

    # Auto-request missing items via Seerr if enabled
    if source.auto_request and missing_items:
        try:
            from .seerr_auto_request import process_auto_requests_for_source
            ar_result = process_auto_requests_for_source(
                config=config,
                integration_type="tmdb",
                source_name=source.name,
                library_type=library.type,
            )
            logger.info(
                "Seerr auto-request for '%s': %d requested, %d skipped, %d already exist, %d failed",
                source.name,
                ar_result.requested,
                ar_result.skipped,
                ar_result.already_exists,
                ar_result.failed,
            )
        except Exception as e:
            logger.error("Seerr auto-request failed for '%s': %s", source.name, e)

    # Mark previously-requested items as downloaded if they now exist in Plex
    if source.auto_request and matched_tmdb_ids:
        try:
            from .seerr_auto_request import mark_auto_requests_downloaded
            media_type = "movie" if library.type == "movie" else "tv"
            downloaded = mark_auto_requests_downloaded(matched_tmdb_ids, media_type)
            if downloaded:
                logger.info("Marked %d auto-requested items as downloaded for '%s'", downloaded, source.name)
        except Exception as e:
            logger.error("Failed to mark downloaded items for '%s': %s", source.name, e)

    return total, matched


def sync_all_tmdb_sources(
    server: PlexServer,
    config: AppConfig,
) -> None:
    if not config.tmdb or not config.tmdb.enabled:
        logger.info("TMDb disabled or not configured; skipping TMDb sync")
        return

    if not config.tmdb.sources:
        logger.info("No TMDb sources configured; skipping TMDb sync")
        return

    for source in config.tmdb.sources:
        try:
            total, matched = sync_single_tmdb_source(server, config, source)
            record_sync_result(
                integration_type="tmdb",
                source_name=source.name,
                source_url=source.url,
                items_total=total,
                items_matched=matched,
            )
        except Exception as e:
            logger.error("Failed to sync TMDb source '%s': %s", source.name, e, exc_info=True)
            record_sync_result(
                integration_type="tmdb",
                source_name=source.name,
                source_url=source.url,
                items_total=0,
                items_matched=0,
                sync_status="error",
                error_message=str(e),
            )


def record_missing_items_in_db(
    source: TMDbSource,
    missing_items: list[dict[str, any]],
) -> None:
    from homescreen_hero.core.db import get_session

    with get_session() as session:
        now = datetime.utcnow()

        for m in missing_items:
            tmdb_id = m.get("tmdb_id")
            title = m.get("title")
            year = m.get("year")
            media_type = m.get("media_type")

            query = session.query(TMDbMissingItem).filter(
                TMDbMissingItem.source_name == source.name,
                TMDbMissingItem.source_url == source.url,
                TMDbMissingItem.title == title,
                TMDbMissingItem.year == year,
            )

            if tmdb_id:
                query = query.filter(TMDbMissingItem.tmdb_id == tmdb_id)

            existing = query.first()

            if existing:
                existing.last_seen = now
                existing.times_seen += 1
            else:
                row = TMDbMissingItem(
                    source_name=source.name,
                    source_url=source.url,
                    plex_library=source.plex_library,
                    plex_collection=source.name,
                    title=title,
                    year=year,
                    tmdb_id=tmdb_id,
                    media_type=media_type,
                    first_seen=now,
                    last_seen=now,
                    times_seen=1,
                )
                session.add(row)

        # Remove items no longer missing
        session.query(TMDbMissingItem).filter(
            TMDbMissingItem.source_name == source.name,
            TMDbMissingItem.source_url == source.url,
            TMDbMissingItem.last_seen < now,
        ).delete()

        session.commit()
