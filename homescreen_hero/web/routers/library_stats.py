from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ...core.auth import CurrentUser, require_admin
from ...core.config.loader import load_config
from ...core.integrations.plex_client import get_plex_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/library-stats", tags=["library-stats"])

# Simple TTL cache: {library_name: (data, timestamp)}
_composition_cache: Dict[str, Tuple[dict, float]] = {}
_CACHE_TTL = 3600  # 1 hour


class CompositionSlice(BaseModel):
    name: str
    count: int


class LibraryCompositionOut(BaseModel):
    library: str
    total_items: int
    genres: List[CompositionSlice]
    resolutions: List[CompositionSlice]
    content_ratings: List[CompositionSlice]


def _normalize_resolution(res: Optional[str]) -> str:
    if not res:
        return "SD"
    res = res.lower().strip()
    if res in ("4k", "2160"):
        return "4K"
    if res == "1080":
        return "1080p"
    if res == "720":
        return "720p"
    if res == "480":
        return "480p"
    return "SD"


def _build_composition(library) -> dict:
    genre_counts: Dict[str, int] = {}
    resolution_counts: Dict[str, int] = {}
    rating_counts: Dict[str, int] = {}

    items = library.all()
    total = len(items)

    for item in items:
        # Genres (an item can have multiple)
        if hasattr(item, "genres") and item.genres:
            for genre in item.genres:
                tag = genre.tag if hasattr(genre, "tag") else str(genre)
                genre_counts[tag] = genre_counts.get(tag, 0) + 1

        # Resolution - movies have media directly, TV shows need an episode sample
        raw_res = None
        if hasattr(item, "media") and item.media:
            raw_res = getattr(item.media[0], "videoResolution", None)
        elif item.type == "show":
            # Grab the first available episode to determine resolution
            try:
                episodes = item.episodes()
                if episodes and hasattr(episodes[0], "media") and episodes[0].media:
                    raw_res = getattr(episodes[0].media[0], "videoResolution", None)
            except Exception:
                pass
        normalized = _normalize_resolution(raw_res)
        resolution_counts[normalized] = resolution_counts.get(normalized, 0) + 1

        # Content rating
        rating = getattr(item, "contentRating", None)
        if not rating:
            rating = "Unrated"
        rating_counts[rating] = rating_counts.get(rating, 0) + 1

    # Sort each descending by count
    def sorted_slices(counts: Dict[str, int]) -> List[dict]:
        return [
            {"name": k, "count": v}
            for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)
        ]

    return {
        "library": library.title,
        "total_items": total,
        "genres": sorted_slices(genre_counts),
        "resolutions": sorted_slices(resolution_counts),
        "content_ratings": sorted_slices(rating_counts),
    }


@router.get("/composition", response_model=LibraryCompositionOut)
def get_library_composition(
    _current_user: CurrentUser = Depends(require_admin),
    library: Optional[str] = Query(None, description="Library name (defaults to first non-music library)"),
) -> LibraryCompositionOut:
    config = load_config()
    server = get_plex_server(config)

    # Resolve library name
    if not library:
        for section in server.library.sections():
            if section.type != "artist":
                library = section.title
                break
        if not library:
            raise HTTPException(status_code=404, detail="No libraries found")

    # Check cache
    now = time.time()
    if library in _composition_cache:
        cached_data, cached_at = _composition_cache[library]
        if now - cached_at < _CACHE_TTL:
            logger.debug("Returning cached composition for '%s'", library)
            return LibraryCompositionOut(**cached_data)

    # Fetch from Plex
    try:
        lib_section = server.library.section(library)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Library '{library}' not found")

    try:
        data = _build_composition(lib_section)
        _composition_cache[library] = (data, now)
        return LibraryCompositionOut(**data)
    except Exception as e:
        logger.error("Error building composition for '%s': %s", library, e)
        raise HTTPException(
            status_code=500, detail=f"Failed to build library composition: {str(e)}"
        )
