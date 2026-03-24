from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from plexapi.exceptions import NotFound
from plexapi.server import PlexServer

from homescreen_hero.core.config.schema import AppConfig, AniListSource
from homescreen_hero.core.db.models import AniListMissingItem
from homescreen_hero.core.db.sync_status import record_sync_result
from homescreen_hero.core.integrations.anilist_client import (
    AniListItem,
    get_anilist_client,
    is_browse_url,
    parse_anilist_url,
    parse_browse_url,
)
from homescreen_hero.core.integrations.anime_id_map import load_anime_id_map_by_anilist
from homescreen_hero.core.integrations.plex_match import (
    build_guid_map,
    normalize_title,
)

logger = logging.getLogger(__name__)

# AniList formats that map to Plex show libraries
SHOW_FORMATS = {"TV", "TV_SHORT", "OVA", "ONA", "SPECIAL"}
MOVIE_FORMATS = {"MOVIE"}


def _guid_lookup(guid_map: dict, *keys: str):
    # Try multiple GUID keys against the map, return first match
    for key in keys:
        if key and key in guid_map:
            return guid_map[key]
    return None


def _match_item(
    item: AniListItem,
    guid_map: dict,
    library,
    anime_id_map: Dict[int, Dict[str, Any]],
    is_movie_library: bool,
):
    # Try to find a Plex item matching an AniList entry
    # 1. Look up mapped IDs from anime-lists
    mapped = anime_id_map.get(item.anilist_id, {})
    tmdb_id = mapped.get("tmdb_id")
    imdb_id = mapped.get("imdb_id")
    tvdb_id = mapped.get("tvdb_id")

    # 2. Direct GUID map lookup (no title fallback — avoids false positives
    #    from find_show/find_movie searching Plex with empty/partial titles)
    if is_movie_library:
        plex_item = _guid_lookup(
            guid_map,
            f"tmdb://{tmdb_id}" if tmdb_id is not None else "",
            f"imdb://{imdb_id}" if imdb_id else "",
            f"com.plexapp.agents.themoviedb://{tmdb_id}?lang=en" if tmdb_id is not None else "",
            f"com.plexapp.agents.imdb://{imdb_id}?lang=en" if imdb_id else "",
        )
    else:
        plex_item = _guid_lookup(
            guid_map,
            f"tvdb://{tvdb_id}" if tvdb_id is not None else "",
            f"tmdb://{tmdb_id}" if tmdb_id is not None else "",
            f"imdb://{imdb_id}" if imdb_id else "",
            f"com.plexapp.agents.thetvdb://{tvdb_id}?lang=en" if tvdb_id is not None else "",
            f"com.plexapp.agents.themoviedb://{tmdb_id}?lang=en" if tmdb_id is not None else "",
            f"com.plexapp.agents.imdb://{imdb_id}?lang=en" if imdb_id else "",
        )
    if plex_item:
        return plex_item

    # 3. Fallback: title/year search
    title = item.title_english or item.title_romaji
    if not title:
        return None

    normalized = normalize_title(title)
    search_title = normalized if normalized != title else title

    if item.year:
        results = library.search(title=search_title, year=item.year)
    else:
        results = library.search(title=search_title)

    if results:
        return results[0]

    # Try romaji title if English title didn't match
    if item.title_romaji and item.title_english and item.title_romaji != title:
        romaji = item.title_romaji
        if item.year:
            results = library.search(title=romaji, year=item.year)
        else:
            results = library.search(title=romaji)
        if results:
            return results[0]

    return None


def sync_single_anilist_source(
    server: PlexServer,
    config: AppConfig,
    source: AniListSource,
) -> Tuple[int, int]:
    # Returns (total_items, matched_items)
    # AniList needs no credentials, so create the client directly
    from homescreen_hero.core.integrations.anilist_client import AniListClient, AniListConfig
    client = AniListClient(AniListConfig())

    logger.info("Syncing AniList source '%s' from %s", source.name, source.url)

    if not source.plex_library:
        logger.warning("AniList source '%s' has no plex_library set; skipping", source.name)
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
            "AniList source '%s' references unknown Plex library '%s'. Available: %s. Skipping.",
            source.name, source.plex_library, available,
        )
        return 0, 0
    except Exception as exc:
        logger.error(
            "Unexpected error looking up Plex library '%s' for AniList source '%s': %s. Skipping.",
            source.plex_library, source.name, exc,
        )
        return 0, 0

    # Detect library type
    is_movie_library = library.type == "movie"

    # Fetch items from AniList (browse list vs user list)
    if is_browse_url(source.url):
        try:
            sort_key = parse_browse_url(source.url)
        except ValueError as exc:
            logger.error("Invalid AniList browse URL for source '%s': %s", source.name, exc)
            return 0, 0
        # Pre-filter by format at the API level so we get a full page of the right type
        format_filter = list(MOVIE_FORMATS) if is_movie_library else list(SHOW_FORMATS)
        max_items = source.max_items or 100
        items = client.get_browse_list(sort_key, max_items=max_items, format_in=format_filter)
    else:
        try:
            username, list_name = parse_anilist_url(source.url)
        except ValueError as exc:
            logger.error("Invalid AniList URL for source '%s': %s", source.name, exc)
            return 0, 0
        items = client.get_user_list(username, list_name)

    # Filter items by format based on library type
    if is_movie_library:
        filtered_items = [i for i in items if i.media_format in MOVIE_FORMATS]
    else:
        filtered_items = [i for i in items if i.media_format in SHOW_FORMATS]

    if not filtered_items:
        logger.info(
            "AniList source '%s': no %s items found (had %d total items)",
            source.name,
            "movie" if is_movie_library else "show",
            len(items),
        )
        return len(items), 0

    # Load anime-lists ID mapping
    anime_id_map = load_anime_id_map_by_anilist()

    # Build Plex GUID map
    logger.info("Building Plex library GUID index for '%s'...", source.plex_library)
    guid_map = build_guid_map(library)

    # Get existing collection items for diff
    existing_collection_items = []
    try:
        existing_collection_items = library.collection(source.name).items()
    except Exception:
        existing_collection_items = []

    existing_ids = {item.ratingKey for item in existing_collection_items}

    matched_items = []
    missing_items: List[Dict[str, Any]] = []

    for item in filtered_items:
        plex_item = _match_item(item, guid_map, library, anime_id_map, is_movie_library)

        if plex_item is not None:
            matched_items.append(plex_item)
        else:
            mapped = anime_id_map.get(item.anilist_id, {})
            missing_items.append({
                "title": item.title_english or item.title_romaji or "Unknown",
                "year": item.year,
                "anilist_id": item.anilist_id,
                "mal_id": item.mal_id,
                "media_format": item.media_format,
                "tmdb_id": mapped.get("tmdb_id"),
                "imdb_id": mapped.get("imdb_id"),
                "tvdb_id": mapped.get("tvdb_id"),
            })

    # Add matched items to the collection
    for plex_item in matched_items:
        plex_item.addCollection(source.name)

    # Only remove items if we successfully fetched from AniList
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
                        old_item.title, source.name,
                    )
    else:
        logger.warning(
            "AniList source '%s' returned no items — skipping removal to prevent data loss.",
            source.name,
        )

    total = len(filtered_items)
    matched = len(matched_items)
    missing = len(missing_items)

    logger.info(
        "AniList source '%s': total %d (%s), matched %d, missing %d",
        source.name, total, "movies" if is_movie_library else "shows", matched, missing,
    )

    if missing_items:
        for m in missing_items:
            logger.debug(
                "AniList missing in Plex: %s (%s) anilist_id=%s",
                m.get("title"), m.get("year"), m.get("anilist_id"),
            )

    # Skip on empty upstream to avoid wiping previously tracked items
    # on transient API failures
    if items:
        record_missing_items_in_db(source, missing_items)

    return total, matched


def sync_all_anilist_sources(
    server: PlexServer,
    config: AppConfig,
) -> None:
    if not config.anilist or not config.anilist.sources:
        logger.info("No AniList sources configured; skipping AniList sync")
        return

    for source in config.anilist.sources:
        try:
            total, matched = sync_single_anilist_source(server, config, source)
            record_sync_result(
                integration_type="anilist",
                source_name=source.name,
                source_url=source.url,
                items_total=total,
                items_matched=matched,
            )
        except Exception as e:
            logger.error("Failed to sync AniList source '%s': %s", source.name, e, exc_info=True)
            record_sync_result(
                integration_type="anilist",
                source_name=source.name,
                source_url=source.url,
                items_total=0,
                items_matched=0,
                sync_status="error",
                error_message=str(e),
            )


def record_missing_items_in_db(
    source: AniListSource,
    missing_items: List[Dict[str, Any]],
) -> None:
    from homescreen_hero.core.db import get_session

    with get_session() as session:
        now = datetime.utcnow()

        for m in missing_items:
            anilist_id = m.get("anilist_id")
            title = m.get("title")
            year = m.get("year")

            existing = session.query(AniListMissingItem).filter(
                AniListMissingItem.source_name == source.name,
                AniListMissingItem.source_url == source.url,
                AniListMissingItem.title == title,
                AniListMissingItem.year == year,
                AniListMissingItem.anilist_id == anilist_id,
            ).first()

            if existing:
                existing.last_seen = now
                existing.times_seen += 1
            else:
                row = AniListMissingItem(
                    source_name=source.name,
                    source_url=source.url,
                    plex_library=source.plex_library,
                    plex_collection=source.name,
                    title=title,
                    year=year,
                    media_format=m.get("media_format"),
                    anilist_id=anilist_id,
                    mal_id=m.get("mal_id"),
                    tmdb_id=m.get("tmdb_id"),
                    imdb_id=m.get("imdb_id"),
                    tvdb_id=m.get("tvdb_id"),
                    first_seen=now,
                    last_seen=now,
                    times_seen=1,
                )
                session.add(row)

        # Flush updates so last_seen values are in the DB before bulk delete
        session.flush()

        # Remove items no longer missing (not seen in this sync)
        session.query(AniListMissingItem).filter(
            AniListMissingItem.source_name == source.name,
            AniListMissingItem.source_url == source.url,
            AniListMissingItem.last_seen < now,
        ).delete()

        session.commit()
