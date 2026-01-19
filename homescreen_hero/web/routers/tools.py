from __future__ import annotations

from datetime import datetime
from typing import List, Optional
import logging

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.plex_client import get_plex_server
from homescreen_hero.core.auth import get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tools", tags=["tools"])


# Response models
class MediaItemResult(BaseModel):
    rating_key: str
    title: str
    year: Optional[int] = None
    thumb: Optional[str] = None
    type: str  # "movie" or "show"
    library: str
    added_at: datetime
    originally_available_at: Optional[datetime] = None


class SearchMediaResponse(BaseModel):
    items: List[MediaItemResult]


# Request models
class UpdateAddedAtItem(BaseModel):
    rating_key: str
    library: str
    new_date: str  # "YYYY-MM-DD" format


class UpdateAddedAtRequest(BaseModel):
    items: List[UpdateAddedAtItem]


class UpdateAddedAtResponse(BaseModel):
    success: bool
    updated_count: int
    errors: List[str]


# Watch History Cleaner models
class TVShowResult(BaseModel):
    rating_key: str
    title: str
    year: Optional[int] = None
    thumb: Optional[str] = None
    library: str
    episode_count: int
    watched_count: int


class SearchShowsResponse(BaseModel):
    items: List[TVShowResult]


class MarkUnwatchedItem(BaseModel):
    rating_key: str
    library: str


class MarkUnwatchedRequest(BaseModel):
    items: List[MarkUnwatchedItem]


class MarkUnwatchedResponse(BaseModel):
    success: bool
    shows_updated: int
    episodes_updated: int
    errors: List[str]


@router.get("/search-media", response_model=SearchMediaResponse)
def search_media(
    query: str,
    library: str = "all",
    limit: int = 50,
    current_user: str = Depends(get_current_user),
) -> SearchMediaResponse:
    """Search for movies and shows across enabled libraries."""
    config = load_config()
    server = get_plex_server(config)

    # Get enabled libraries from config
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    # Filter to specific library if provided
    if library and library != "all":
        if library not in enabled_libraries:
            raise HTTPException(
                status_code=404,
                detail=f"Library '{library}' not found or not enabled",
            )
        enabled_libraries = [library]

    all_items: List[MediaItemResult] = []

    for lib_name in enabled_libraries:
        try:
            section = server.library.section(lib_name)

            # Skip non-movie/show libraries
            if section.type not in ("movie", "show"):
                continue

            items = section.search(title=query, limit=limit)

            for item in items:
                thumb_url = None
                if hasattr(item, "thumb") and item.thumb:
                    thumb_url = server.url(item.thumb, includeToken=True)

                # Get addedAt and originallyAvailableAt
                added_at = getattr(item, "addedAt", None)
                originally_available_at = getattr(item, "originallyAvailableAt", None)

                if added_at is None:
                    logger.warning(f"Item '{item.title}' has no addedAt date, skipping")
                    continue

                all_items.append(
                    MediaItemResult(
                        rating_key=str(item.ratingKey),
                        title=item.title,
                        year=getattr(item, "year", None),
                        thumb=thumb_url,
                        type=item.type,
                        library=lib_name,
                        added_at=added_at,
                        originally_available_at=originally_available_at,
                    )
                )
        except Exception as e:
            logger.warning(f"Error searching library {lib_name}: {e}")
            continue

    # Sort by title and limit results
    all_items.sort(key=lambda x: x.title.lower())
    all_items = all_items[:limit]

    return SearchMediaResponse(items=all_items)


@router.post("/update-added-at", response_model=UpdateAddedAtResponse)
def update_added_at(
    request: UpdateAddedAtRequest,
    current_user: str = Depends(get_current_user),
) -> UpdateAddedAtResponse:
    """Update the addedAt date for one or more media items."""
    config = load_config()
    server = get_plex_server(config)

    updated_count = 0
    errors: List[str] = []

    for item_req in request.items:
        try:
            section = server.library.section(item_req.library)
            item = section.fetchItem(int(item_req.rating_key))

            if not item:
                errors.append(f"Item {item_req.rating_key} not found in {item_req.library}")
                continue

            # Use PlexAPI's editAddedAt method (accepts 'YYYY-MM-DD' string)
            item.editAddedAt(item_req.new_date).reload()
            updated_count += 1

            logger.info(
                f"Updated addedAt for '{item.title}' ({item_req.rating_key}) to {item_req.new_date}"
            )

        except Exception as e:
            error_msg = f"Failed to update {item_req.rating_key}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

    return UpdateAddedAtResponse(
        success=len(errors) == 0,
        updated_count=updated_count,
        errors=errors,
    )


@router.get("/search-shows", response_model=SearchShowsResponse)
def search_shows(
    query: str,
    library: str = "all",
    limit: int = 50,
    current_user: str = Depends(get_current_user),
) -> SearchShowsResponse:
    """Search for TV shows with episode watch counts."""
    config = load_config()
    server = get_plex_server(config)

    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    if library and library != "all":
        if library not in enabled_libraries:
            raise HTTPException(
                status_code=404,
                detail=f"Library '{library}' not found or not enabled",
            )
        enabled_libraries = [library]

    all_items: List[TVShowResult] = []

    for lib_name in enabled_libraries:
        try:
            section = server.library.section(lib_name)

            # Only search show libraries
            if section.type != "show":
                continue

            shows = section.search(title=query, limit=limit)

            for show in shows:
                thumb_url = None
                if hasattr(show, "thumb") and show.thumb:
                    thumb_url = server.url(show.thumb, includeToken=True)

                # Get episode counts
                episodes = show.episodes()
                episode_count = len(episodes)
                watched_count = sum(1 for ep in episodes if ep.isWatched)

                all_items.append(
                    TVShowResult(
                        rating_key=str(show.ratingKey),
                        title=show.title,
                        year=getattr(show, "year", None),
                        thumb=thumb_url,
                        library=lib_name,
                        episode_count=episode_count,
                        watched_count=watched_count,
                    )
                )
        except Exception as e:
            logger.warning(f"Error searching library {lib_name}: {e}")
            continue

    all_items.sort(key=lambda x: x.title.lower())
    all_items = all_items[:limit]

    return SearchShowsResponse(items=all_items)


@router.post("/mark-unwatched", response_model=MarkUnwatchedResponse)
def mark_unwatched(
    request: MarkUnwatchedRequest,
    current_user: str = Depends(get_current_user),
) -> MarkUnwatchedResponse:
    """Mark all episodes of selected TV shows as unwatched."""
    config = load_config()
    server = get_plex_server(config)

    shows_updated = 0
    episodes_updated = 0
    errors: List[str] = []

    for item_req in request.items:
        try:
            section = server.library.section(item_req.library)
            show = section.fetchItem(int(item_req.rating_key))

            if not show:
                errors.append(f"Show {item_req.rating_key} not found in {item_req.library}")
                continue

            episodes = show.episodes()
            show_episodes_updated = 0

            for episode in episodes:
                if episode.isWatched:
                    episode.markUnwatched()
                    show_episodes_updated += 1

            if show_episodes_updated > 0:
                shows_updated += 1
                episodes_updated += show_episodes_updated
                logger.info(
                    f"Marked {show_episodes_updated} episodes of '{show.title}' as unwatched"
                )

        except Exception as e:
            error_msg = f"Failed to update {item_req.rating_key}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

    return MarkUnwatchedResponse(
        success=len(errors) == 0,
        shows_updated=shows_updated,
        episodes_updated=episodes_updated,
        errors=errors,
    )
