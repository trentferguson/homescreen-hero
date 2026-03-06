from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from plexapi.exceptions import NotFound
from plexapi.server import PlexServer

from homescreen_hero.core.config.schema import AppConfig, MALSource
from homescreen_hero.core.db.models import MALMissingItem
from homescreen_hero.core.db.sync_status import record_sync_result
from homescreen_hero.core.integrations.anime_id_map import load_anime_id_map_by_mal
from homescreen_hero.core.integrations.mal_client import (
    MALClient,
    MALConfig,
    MALItem,
    is_browse_url,
    is_ranking_url,
    is_season_url,
    parse_mal_user_url,
    parse_ranking_url,
    parse_season_url,
)
from homescreen_hero.core.integrations.plex_match import (
    build_guid_map,
    normalize_title,
)

logger = logging.getLogger(__name__)

# MAL media_type values that map to Plex show vs movie libraries
SHOW_TYPES = {"tv", "ova", "ona", "special"}
MOVIE_TYPES = {"movie"}


def _guid_lookup(guid_map: dict, *keys: str):
    for key in keys:
        if key and key in guid_map:
            return guid_map[key]
    return None


def _match_item(
    item: MALItem,
    guid_map: dict,
    library,
    anime_id_map: Dict[int, Dict[str, Any]],
    is_movie_library: bool,
):

    mapped = anime_id_map.get(item.mal_id, {})
    tmdb_id = mapped.get("tmdb_id")
    imdb_id = mapped.get("imdb_id")
    tvdb_id = mapped.get("tvdb_id")

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

    # Fallback: title/year search
    title = item.title_en or item.title
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

    # Try Japanese title if English title didn't match
    if item.title_ja and item.title_ja != title:
        if item.year:
            results = library.search(title=item.title_ja, year=item.year)
        else:
            results = library.search(title=item.title_ja)
        if results:
            return results[0]

    return None


def sync_single_mal_source(
    server: PlexServer,
    config: AppConfig,
    source: MALSource,
) -> Tuple[int, int]:
    if not config.mal or not config.mal.client_id:
        logger.warning("MAL is not configured; skipping sync for '%s'", source.name)
        return 0, 0

    client = MALClient(MALConfig(client_id=config.mal.client_id))

    logger.info("Syncing MAL source '%s' from %s", source.name, source.url)

    if not source.plex_library:
        logger.warning("MAL source '%s' has no plex_library set; skipping", source.name)
        return 0, 0

    try:
        library = server.library.section(source.plex_library)
    except NotFound:
        try:
            available = ", ".join(sec.title for sec in server.library.sections())
        except Exception:
            available = "unknown (failed to list libraries)"
        logger.error(
            "MAL source '%s' references unknown Plex library '%s'. Available: %s. Skipping.",
            source.name, source.plex_library, available,
        )
        return 0, 0
    except Exception as exc:
        logger.error(
            "Unexpected error looking up Plex library '%s' for MAL source '%s': %s. Skipping.",
            source.plex_library, source.name, exc,
        )
        return 0, 0

    is_movie_library = library.type == "movie"

    max_items = source.max_items or 100
    if is_ranking_url(source.url):
        try:
            ranking_type = parse_ranking_url(source.url)
        except ValueError as exc:
            logger.error("Invalid MAL ranking URL for source '%s': %s", source.name, exc)
            return 0, 0
        items = client.get_ranking_list(ranking_type, max_items=max_items)
    elif is_season_url(source.url):
        try:
            year, season = parse_season_url(source.url)
        except ValueError as exc:
            logger.error("Invalid MAL season URL for source '%s': %s", source.name, exc)
            return 0, 0
        items = client.get_seasonal_list(year, season, max_items=max_items)
    else:
        try:
            username, status = parse_mal_user_url(source.url)
        except ValueError as exc:
            logger.error("Invalid MAL URL for source '%s': %s", source.name, exc)
            return 0, 0
        items = client.get_user_list(username, status)

    # Filter items by media_type based on library type
    if is_movie_library:
        filtered_items = [i for i in items if i.media_type in MOVIE_TYPES]
    else:
        filtered_items = [i for i in items if i.media_type in SHOW_TYPES]

    if not filtered_items:
        logger.info(
            "MAL source '%s': no %s items found (had %d total items)",
            source.name,
            "movie" if is_movie_library else "show",
            len(items),
        )
        return len(items), 0

    anime_id_map = load_anime_id_map_by_mal()

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

    for item in filtered_items:
        plex_item = _match_item(item, guid_map, library, anime_id_map, is_movie_library)

        if plex_item is not None:
            matched_items.append(plex_item)
        else:
            mapped = anime_id_map.get(item.mal_id, {})
            missing_items.append({
                "title": item.title_en or item.title or "Unknown",
                "year": item.year,
                "mal_id": item.mal_id,
                "media_type": item.media_type,
                "anilist_id": mapped.get("anilist_id"),
                "tmdb_id": mapped.get("tmdb_id"),
                "imdb_id": mapped.get("imdb_id"),
                "tvdb_id": mapped.get("tvdb_id"),
            })

    for plex_item in matched_items:
        plex_item.addCollection(source.name)

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
            "MAL source '%s' returned no items -- skipping removal to prevent data loss.",
            source.name,
        )

    total = len(filtered_items)
    matched = len(matched_items)
    missing = len(missing_items)

    logger.info(
        "MAL source '%s': total %d (%s), matched %d, missing %d",
        source.name, total, "movies" if is_movie_library else "shows", matched, missing,
    )

    if missing_items:
        for m in missing_items:
            logger.debug(
                "MAL missing in Plex: %s (%s) mal_id=%s",
                m.get("title"), m.get("year"), m.get("mal_id"),
            )

    record_missing_items_in_db(source, missing_items)

    return total, matched


def sync_all_mal_sources(
    server: PlexServer,
    config: AppConfig,
) -> None:
    if not config.mal or not config.mal.enabled or not config.mal.sources:
        logger.info("No MAL sources configured; skipping MAL sync")
        return

    for source in config.mal.sources:
        try:
            total, matched = sync_single_mal_source(server, config, source)
            record_sync_result(
                integration_type="mal",
                source_name=source.name,
                source_url=source.url,
                items_total=total,
                items_matched=matched,
            )
        except Exception as e:
            logger.error("Failed to sync MAL source '%s': %s", source.name, e, exc_info=True)
            record_sync_result(
                integration_type="mal",
                source_name=source.name,
                source_url=source.url,
                items_total=0,
                items_matched=0,
                sync_status="error",
                error_message=str(e),
            )


def record_missing_items_in_db(
    source: MALSource,
    missing_items: List[Dict[str, Any]],
) -> None:
    from homescreen_hero.core.db import get_session

    with get_session() as session:
        now = datetime.utcnow()

        for m in missing_items:
            mal_id = m.get("mal_id")
            title = m.get("title")
            year = m.get("year")

            existing = session.query(MALMissingItem).filter(
                MALMissingItem.source_name == source.name,
                MALMissingItem.source_url == source.url,
                MALMissingItem.title == title,
                MALMissingItem.year == year,
                MALMissingItem.mal_id == mal_id,
            ).first()

            if existing:
                existing.last_seen = now
                existing.times_seen += 1
            else:
                row = MALMissingItem(
                    source_name=source.name,
                    source_url=source.url,
                    plex_library=source.plex_library,
                    plex_collection=source.name,
                    title=title,
                    year=year,
                    media_type=m.get("media_type"),
                    mal_id=mal_id,
                    anilist_id=m.get("anilist_id"),
                    tmdb_id=m.get("tmdb_id"),
                    imdb_id=m.get("imdb_id"),
                    tvdb_id=m.get("tvdb_id"),
                    first_seen=now,
                    last_seen=now,
                    times_seen=1,
                )
                session.add(row)

        # Remove items no longer missing (not seen in this sync)
        session.query(MALMissingItem).filter(
            MALMissingItem.source_name == source.name,
            MALMissingItem.source_url == source.url,
            MALMissingItem.last_seen < now,
        ).delete()

        session.commit()
