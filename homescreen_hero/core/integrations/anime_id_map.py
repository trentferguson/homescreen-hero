from __future__ import annotations

# Shared anime-lists mapping download, cache, and indexing.
# Used by both AniList sync (indexes by anilist_id) and MAL sync (indexes by mal_id).

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

ANIME_LIST_URL = (
    "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json"
)
ANIME_LIST_CACHE_FILE = "anime-list-full.json"
ANIME_LIST_MAX_AGE_SECONDS = 86400  # 24 hours


def _get_data_dir() -> Path:
    data_dir = Path(os.getenv("HSH_DATA_DIR", "data"))
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def _load_raw_anime_list(data_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    # Download (or load from cache) the raw anime-lists JSON array
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
            logger.info(
                "Anime-lists mapping downloaded and cached (%d bytes)", len(resp.content)
            )
        except Exception as exc:
            if cache_path.exists():
                logger.warning(
                    "Failed to refresh anime-lists mapping: %s. Using cached version.",
                    exc,
                )
            else:
                logger.error("Failed to download anime-lists mapping: %s", exc)
                return []

    try:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Failed to parse anime-lists JSON: %s", exc)
        return []


def load_anime_id_map_by_anilist(
    data_dir: Optional[Path] = None,
) -> Dict[int, Dict[str, Any]]:
    # Returns {anilist_id: {tmdb_id, imdb_id, tvdb_id, type}}
    raw = _load_raw_anime_list(data_dir)
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

    logger.info(
        "Loaded anime-lists mapping: %d entries indexed by AniList ID", len(id_map)
    )
    return id_map


def load_anime_id_map_by_mal(
    data_dir: Optional[Path] = None,
) -> Dict[int, Dict[str, Any]]:
    # Returns {mal_id: {tmdb_id, imdb_id, tvdb_id, anilist_id, type}}
    raw = _load_raw_anime_list(data_dir)
    id_map: Dict[int, Dict[str, Any]] = {}
    for entry in raw:
        mal_id = entry.get("mal_id")
        if mal_id is None:
            continue
        id_map[mal_id] = {
            "tmdb_id": entry.get("themoviedb_id"),
            "imdb_id": entry.get("imdb_id"),
            "tvdb_id": entry.get("tvdb_id"),
            "anilist_id": entry.get("anilist_id"),
            "type": entry.get("type"),
        }

    logger.info(
        "Loaded anime-lists mapping: %d entries indexed by MAL ID", len(id_map)
    )
    return id_map
