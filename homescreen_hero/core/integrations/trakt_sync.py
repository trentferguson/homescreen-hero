from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Tuple

import logging

from plexapi.server import PlexServer
from plexapi.exceptions import NotFound
from homescreen_hero.core.db.models import TraktMissingItem
from homescreen_hero.core.db.sync_status import record_sync_result
from homescreen_hero.core.config.schema import AppConfig, TraktSource
from homescreen_hero.core.integrations.trakt_client import get_trakt_client
from homescreen_hero.core.integrations.plex_match import build_guid_map, find_movie

logger = logging.getLogger(__name__)


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
        if item.get("type") != "movie":
            continue

        movie = item.get("movie") or {}
        title = movie.get("title")
        year = movie.get("year")
        ids = movie.get("ids") or {}

        if not title:
            continue

        plex_item = find_movie(
            guid_map, library, title, year,
            imdb_id=ids.get("imdb"),
            tmdb_id=ids.get("tmdb"),
        )

        if plex_item is not None:
            matched_items.append(plex_item)
            if ids.get("tmdb"):
                matched_tmdb_ids.add(ids["tmdb"])
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

    # Only remove items if we successfully fetched items from Trakt
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
            "Trakt source '%s' returned no items - skipping removal to prevent data loss. "
            "This could indicate a network error or API failure.",
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

    if missing_items:
        for m in missing_items:
            logger.debug(
                "Trakt missing in Plex: %s (%s) ids=%s",
                m.get("title"),
                m.get("year"),
                m.get("ids"),
            )

    # Persist missing items in the database (skip on empty upstream to avoid
    # wiping previously tracked items on transient API failures)
    if items:
        record_missing_items_in_db(source, missing_items)

    # Auto-request missing items via Seerr if enabled for this source
    if source.auto_request and missing_items:
        try:
            from .seerr_auto_request import process_auto_requests_for_source
            ar_result = process_auto_requests_for_source(
                config=config,
                integration_type="trakt",
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
        try:
            total, matched = sync_single_trakt_source(server, config, source)
            record_sync_result(
                integration_type="trakt",
                source_name=source.name,
                source_url=source.url,
                items_total=total,
                items_matched=matched,
            )
        except Exception as e:
            logger.error("Failed to sync Trakt source '%s': %s", source.name, e, exc_info=True)
            record_sync_result(
                integration_type="trakt",
                source_name=source.name,
                source_url=source.url,
                items_total=0,
                items_matched=0,
                sync_status="error",
                error_message=str(e),
            )


def record_missing_items_in_db(
    source: TraktSource,
    missing_items: list[dict[str, any]],
) -> None:
    # Store/update records for Trakt titles that weren't found in Plex library,
    # and remove any previously-missing items that are now matched.
    from homescreen_hero.core.db import get_session

    with get_session() as session:
        now = datetime.utcnow()

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
                existing.last_seen = now
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
                    first_seen=now,
                    last_seen=now,
                    times_seen=1,
                )
                session.add(row)

        # Flush updates so last_seen values are in the DB before bulk delete
        session.flush()

        # Remove items no longer missing (not seen in this sync)
        session.query(TraktMissingItem).filter(
            TraktMissingItem.source_name == source.name,
            TraktMissingItem.source_url == source.url,
            TraktMissingItem.last_seen < now,
        ).delete()

        session.commit()
