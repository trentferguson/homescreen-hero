from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from plexapi.exceptions import NotFound
from plexapi.server import PlexServer

from homescreen_hero.core.config.schema import AppConfig, AniListSource
from homescreen_hero.core.db.models import AniListMissingItem
from homescreen_hero.core.integrations.anilist_client import (
    AniListItem,
    get_anilist_client,
    parse_anilist_url,
)
from homescreen_hero.core.integrations.plex_match import (
    build_guid_map,
    find_movie,
    find_show,
    normalize_title,
)

logger = logging.getLogger(__name__)

ANIME_LIST_URL = (
    "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json"
)
ANIME_LIST_CACHE_FILE = "anime-list-full.json"
ANIME_LIST_MAX_AGE_SECONDS = 86400  # 24 hours

# AniList formats that map to Plex show libraries
SHOW_FORMATS = {"TV", "TV_SHORT", "OVA", "ONA", "SPECIAL"}
MOVIE_FORMATS = {"MOVIE"}


def _get_data_dir() -> Path:
    # Resolve the data directory for caching files
    data_dir = Path(os.getenv("HSH_DATA_DIR", "data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def load_anime_id_map(data_dir: Optional[Path] = None) -> Dict[int, Dict[str, Any]]:
    # Download (or load from cache) the anime-lists mapping file
    # Returns {anilist_id: {tmdb_id, imdb_id, tvdb_id, type}}
    if data_dir is None:
        data_dir = _get_data_dir()

    cache_path = data_dir / ANIME_LIST_CACHE_FILE
    needs_download = True

    if cache_path.exists():
        age = time.time() - cache_path.stat().st_mtime
        if age < ANIME_LIST_MAX_AGE_SECONDS:
            needs_download = False

    if needs_download:
        logger.info("Downloading anime-lists mapping from GitHub...")
        try:
            resp = requests.get(ANIME_LIST_URL, timeout=60)
            resp.raise_for_status()
            cache_path.write_bytes(resp.content)
            logger.info("Anime-lists mapping downloaded and cached (%d bytes)", len(resp.content))
        except Exception as exc:
            if cache_path.exists():
                logger.warning(
                    "Failed to refresh anime-lists mapping: %s. Using cached version.", exc
                )
            else:
                logger.error("Failed to download anime-lists mapping: %s", exc)
                return {}

    try:
        raw = json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Failed to parse anime-lists JSON: %s", exc)
        return {}

    # Build lookup by anilist_id
    id_map: Dict[int, Dict[str, Any]] = {}
    for entry in raw:
        anilist_id = entry.get("anilist_id")
        if anilist_id is None:
            continue
        id_map[anilist_id] = {
            "tmdb_id": entry.get("themoviedb_id"),
            "imdb_id": entry.get("imdb_id"),
            "tvdb_id": entry.get("tvdb_id"),
            "type": entry.get("type"),
        }

    logger.info("Loaded anime-lists mapping: %d entries indexed by AniList ID", len(id_map))
    return id_map


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

    # 2. Try GUID-based matching
    if is_movie_library:
        plex_item = find_movie(guid_map, library, "", None, imdb_id=imdb_id, tmdb_id=tmdb_id)
        if plex_item:
            return plex_item
    else:
        plex_item = find_show(guid_map, library, "", None, tvdb_id=tvdb_id, tmdb_id=tmdb_id, imdb_id=imdb_id)
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

    # Parse URL to extract username and optional list name
    try:
        username, list_name = parse_anilist_url(source.url)
    except ValueError as exc:
        logger.error("Invalid AniList URL for source '%s': %s", source.name, exc)
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

    # Fetch items from AniList
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
    anime_id_map = load_anime_id_map()

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
            sync_single_anilist_source(server, config, source)
        except Exception as e:
            logger.error("Failed to sync AniList source '%s': %s", source.name, e, exc_info=True)


def record_missing_items_in_db(
    source: AniListSource,
    missing_items: List[Dict[str, Any]],
) -> None:
    if not missing_items:
        return

    from homescreen_hero.core.db import get_session

    with get_session() as session:
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
                existing.last_seen = datetime.utcnow()
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
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    times_seen=1,
                )
                session.add(row)

        session.commit()
