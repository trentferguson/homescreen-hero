from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import List, Optional, Literal
import logging
import csv
import io
import math

from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.plex_client import get_plex_server
from homescreen_hero.core.integrations.tautulli_client import get_tautulli_client
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


# Unwatched Report models
class UnwatchedReportRequest(BaseModel):
    library: str
    unwatched_mode: Literal["never_watched", "not_watched_since"]
    time_period: Optional[str] = None  # "30d", "90d", "6m", "1y", "all", "custom"
    custom_start_date: Optional[date] = None
    page: int = 1
    page_size: int = 50


class UnwatchedItem(BaseModel):
    rating_key: str
    title: str
    year: Optional[int] = None
    thumb: Optional[str] = None
    type: str  # "movie" or "show"
    library: str
    added_at: Optional[str] = None
    last_watched_at: Optional[str] = None
    total_plays: int = 0


class UnwatchedReportResponse(BaseModel):
    items: List[UnwatchedItem]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    time_period_description: str


@router.get("/recent-media", response_model=SearchMediaResponse)
def get_recent_media(
    library: str = "all",
    limit: int = 50,
    current_user: str = Depends(get_current_user),
) -> SearchMediaResponse:
    """Get recently added movies and shows, sorted by added_at descending."""
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

    all_items: List[MediaItemResult] = []

    for lib_name in enabled_libraries:
        try:
            section = server.library.section(lib_name)

            if section.type not in ("movie", "show"):
                continue

            # Fetch recently added items using Plex's recentlyAdded method
            items = section.recentlyAdded(maxresults=limit)

            for item in items:
                thumb_url = None
                if hasattr(item, "thumb") and item.thumb:
                    thumb_url = server.url(item.thumb, includeToken=True)

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
            logger.warning(f"Error fetching recent items from {lib_name}: {e}")
            continue

    # Sort by added_at descending (most recent first) and limit
    all_items.sort(key=lambda x: x.added_at, reverse=True)
    all_items = all_items[:limit]

    return SearchMediaResponse(items=all_items)


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


def _calculate_cutoff_date(
    time_period: Optional[str], custom_date: Optional[date] = None
) -> Optional[date]:
    # Calculate the cutoff date based on time period
    if time_period == "custom" and custom_date:
        return custom_date
    periods = {"30d": 30, "90d": 90, "6m": 182, "1y": 365, "all": None}
    days = periods.get(time_period or "all")
    return date.today() - timedelta(days=days) if days else None


def _get_time_period_description(
    unwatched_mode: str, time_period: Optional[str], custom_date: Optional[date]
) -> str:
    # Generate human-readable description of the time period
    if unwatched_mode == "never_watched":
        return "Items that have never been watched"

    if time_period == "custom" and custom_date:
        return f"Items not watched since {custom_date.strftime('%B %d, %Y')}"

    descriptions = {
        "30d": "Items not watched in the last 30 days",
        "90d": "Items not watched in the last 90 days",
        "6m": "Items not watched in the last 6 months",
        "1y": "Items not watched in the last year",
        "all": "Items that have never been watched",
    }
    return descriptions.get(time_period or "all", "Items not watched")


def _get_unwatched_items(
    config,
    library_name: str,
    unwatched_mode: str,
    cutoff_date: Optional[date],
) -> List[dict]:
    # Get Tautulli client
    tautulli = get_tautulli_client(config)
    if not tautulli:
        raise HTTPException(
            status_code=400,
            detail="Tautulli is not configured. Please enable Tautulli in integrations.",
        )

    # Get Plex server and library
    server = get_plex_server(config)
    try:
        section = server.library.section(library_name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Library '{library_name}' not found")

    if section.type not in ("movie", "show"):
        raise HTTPException(
            status_code=400, detail="Only movie and show libraries are supported"
        )

    # Fetch all items from the library
    library_items = section.all()
    logger.info(f"Found {len(library_items)} items in library '{library_name}'")

    # Fetch watch history from Tautulli (all users)
    # Paginate to get complete history - Tautulli returns history for ALL users by default
    all_history: List[dict] = []
    batch_size = 5000
    start = 0
    while True:
        batch = tautulli.get_history(length=batch_size, start=start)
        if not batch:
            break
        all_history.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
        # Safety limit to prevent infinite loops
        if start > 50000:
            break

    logger.info(f"Retrieved {len(all_history)} total history entries from Tautulli (all users)")

    # Build watch history maps:
    # - watch_map: {rating_key: {last_watched_at, total_plays}} for movies/episodes
    # - show_watch_map: {grandparent_rating_key: {last_watched_at, total_plays}} for TV shows
    watch_map: dict = {}
    show_watch_map: dict = {}

    for entry in all_history:
        rating_key = str(entry.get("rating_key", ""))
        if not rating_key:
            continue

        # Parse the date (Tautulli returns Unix timestamp in 'date' field)
        timestamp = entry.get("date") or entry.get("started")
        if not timestamp:
            continue

        try:
            watched_at = datetime.fromtimestamp(int(timestamp))
        except (ValueError, TypeError):
            continue

        # Track by rating_key (for movies and individual episodes)
        if rating_key not in watch_map:
            watch_map[rating_key] = {"last_watched_at": watched_at, "total_plays": 1}
        else:
            watch_map[rating_key]["total_plays"] += 1
            if watched_at > watch_map[rating_key]["last_watched_at"]:
                watch_map[rating_key]["last_watched_at"] = watched_at

        # For TV episodes, also track by grandparent_rating_key (the show)
        # This lets us check if ANY episode of a show has been watched
        grandparent_key = str(entry.get("grandparent_rating_key", ""))
        if grandparent_key:
            if grandparent_key not in show_watch_map:
                show_watch_map[grandparent_key] = {"last_watched_at": watched_at, "total_plays": 1}
            else:
                show_watch_map[grandparent_key]["total_plays"] += 1
                if watched_at > show_watch_map[grandparent_key]["last_watched_at"]:
                    show_watch_map[grandparent_key]["last_watched_at"] = watched_at

    # Cross-reference and filter unwatched items
    unwatched_items = []
    for item in library_items:
        rating_key = str(item.ratingKey)

        # For TV shows, check show_watch_map; for movies, check watch_map
        if item.type == "show":
            watch_info = show_watch_map.get(rating_key)
        else:
            watch_info = watch_map.get(rating_key)

        is_unwatched = False
        last_watched = None
        total_plays = 0

        if watch_info is None:
            # Never watched by anyone
            is_unwatched = True
        else:
            last_watched = watch_info["last_watched_at"]
            total_plays = watch_info["total_plays"]

            if unwatched_mode == "not_watched_since" and cutoff_date:
                # Check if last watched is before cutoff
                if last_watched.date() < cutoff_date:
                    is_unwatched = True
            # For "never_watched" mode, only include if not in watch_map (handled above)

        if is_unwatched:
            thumb_url = None
            if hasattr(item, "thumb") and item.thumb:
                thumb_url = server.url(item.thumb, includeToken=True)

            added_at = getattr(item, "addedAt", None)
            added_at_str = added_at.strftime("%Y-%m-%d") if added_at else None

            last_watched_str = (
                last_watched.strftime("%Y-%m-%d") if last_watched else None
            )

            unwatched_items.append(
                {
                    "rating_key": rating_key,
                    "title": item.title,
                    "year": getattr(item, "year", None),
                    "thumb": thumb_url,
                    "type": item.type,
                    "library": library_name,
                    "added_at": added_at_str,
                    "last_watched_at": last_watched_str,
                    "total_plays": total_plays,
                }
            )

    # Sort by title
    unwatched_items.sort(key=lambda x: x["title"].lower())
    return unwatched_items


@router.post("/unwatched-report", response_model=UnwatchedReportResponse)
def generate_unwatched_report(
    request: UnwatchedReportRequest,
    current_user: str = Depends(get_current_user),
) -> UnwatchedReportResponse:
    # Generate a paginated report of unwatched items
    config = load_config()

    # Calculate cutoff date for "not_watched_since" mode
    cutoff_date = None
    if request.unwatched_mode == "not_watched_since":
        cutoff_date = _calculate_cutoff_date(
            request.time_period, request.custom_start_date
        )

    # Get all unwatched items
    all_items = _get_unwatched_items(
        config, request.library, request.unwatched_mode, cutoff_date
    )

    # Paginate results
    total_count = len(all_items)
    total_pages = max(1, math.ceil(total_count / request.page_size))
    page = min(max(1, request.page), total_pages)

    start_idx = (page - 1) * request.page_size
    end_idx = start_idx + request.page_size
    page_items = all_items[start_idx:end_idx]

    # Convert to response model
    items = [UnwatchedItem(**item) for item in page_items]

    time_description = _get_time_period_description(
        request.unwatched_mode, request.time_period, request.custom_start_date
    )

    return UnwatchedReportResponse(
        items=items,
        total_count=total_count,
        page=page,
        page_size=request.page_size,
        total_pages=total_pages,
        time_period_description=time_description,
    )


@router.post("/unwatched-report/export")
def export_unwatched_report(
    request: UnwatchedReportRequest,
    current_user: str = Depends(get_current_user),
) -> Response:
    # Export unwatched report as CSV
    config = load_config()

    # Calculate cutoff date
    cutoff_date = None
    if request.unwatched_mode == "not_watched_since":
        cutoff_date = _calculate_cutoff_date(
            request.time_period, request.custom_start_date
        )

    # Get all unwatched items (no pagination for export)
    all_items = _get_unwatched_items(
        config, request.library, request.unwatched_mode, cutoff_date
    )

    # Build CSV content
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(
        ["Title", "Year", "Type", "Library", "Added Date", "Last Watched", "Total Plays"]
    )

    # Data rows
    for item in all_items:
        writer.writerow(
            [
                item["title"],
                item["year"] or "",
                item["type"],
                item["library"],
                item["added_at"] or "",
                item["last_watched_at"] or "Never",
                item["total_plays"],
            ]
        )

    csv_content = output.getvalue()

    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_library = request.library.replace(" ", "_").replace("/", "_")
    filename = f"unwatched_report_{safe_library}_{timestamp}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
