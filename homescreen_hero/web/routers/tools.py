from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import List, Optional, Literal
import logging
import csv
import io
import json
import math

from fastapi import APIRouter, HTTPException, Depends, Response, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.plex_client import (
    get_plex_server,
    get_home_users,
    get_server_for_user,
)
from homescreen_hero.core.integrations.tautulli_client import get_tautulli_client
from homescreen_hero.core.auth import CurrentUser, get_current_user, require_admin
from homescreen_hero.core.poster_proxy import create_proxy_url


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
    file_size: Optional[int] = None  # Size in bytes


class UnwatchedReportResponse(BaseModel):
    items: List[UnwatchedItem]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    time_period_description: str


# Copy Watch History models
class HomeUser(BaseModel):
    id: int
    username: str
    title: str
    thumb: Optional[str] = None
    is_admin: bool = False


class HomeUsersResponse(BaseModel):
    users: List[HomeUser]


class CopyWatchHistoryPreviewRequest(BaseModel):
    source_user: str  # username
    target_user: str  # username


class WatchHistoryPreviewCounts(BaseModel):
    movies_to_mark_watched: int = 0
    movies_to_mark_unwatched: int = 0
    episodes_to_mark_watched: int = 0
    episodes_to_mark_unwatched: int = 0
    shows_affected: int = 0


class CopyWatchHistoryPreviewResponse(BaseModel):
    source_user: str
    target_user: str
    counts: WatchHistoryPreviewCounts
    libraries_processed: List[str]


ConflictMode = Literal["only_add", "mirror"]


class CopyWatchHistoryApplyRequest(BaseModel):
    source_user: str  # username
    target_user: str  # username
    conflict_mode: ConflictMode


class CopyWatchHistoryApplyResponse(BaseModel):
    success: bool
    movies_updated: int
    episodes_updated: int
    errors: List[str]


@router.get("/recent-media", response_model=SearchMediaResponse)
def get_recent_media(
    library: str = "all",
    limit: int = 50,
    current_user: CurrentUser = Depends(require_admin),
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
                    thumb_url = create_proxy_url(server.url(item.thumb, includeToken=True))

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
    current_user: CurrentUser = Depends(require_admin),
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
                    thumb_url = create_proxy_url(server.url(item.thumb, includeToken=True))

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
    current_user: CurrentUser = Depends(require_admin),
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
    current_user: CurrentUser = Depends(require_admin),
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
                    thumb_url = create_proxy_url(server.url(show.thumb, includeToken=True))

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
    current_user: CurrentUser = Depends(require_admin),
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


def _get_item_file_size(item) -> Optional[int]:
    # Calculate total file size in bytes for a Plex item
    # For movies: sum all media parts
    # For TV shows: sum all episode media parts
    try:
        if item.type == "movie":
            total_size = 0
            for media in item.media:
                for part in media.parts:
                    if hasattr(part, "size") and part.size:
                        total_size += part.size
            return total_size if total_size > 0 else None

        elif item.type == "show":
            # For shows, we need to sum up all episodes
            total_size = 0
            episodes = item.episodes()
            for episode in episodes:
                for media in episode.media:
                    for part in media.parts:
                        if hasattr(part, "size") and part.size:
                            total_size += part.size
            return total_size if total_size > 0 else None

        return None
    except Exception as e:
        logger.warning(f"Failed to get file size for '{item.title}': {e}")
        return None


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
                thumb_url = create_proxy_url(server.url(item.thumb, includeToken=True))

            added_at = getattr(item, "addedAt", None)
            added_at_str = added_at.strftime("%Y-%m-%d") if added_at else None

            last_watched_str = (
                last_watched.strftime("%Y-%m-%d") if last_watched else None
            )

            # Get file size
            file_size = _get_item_file_size(item)

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
                    "file_size": file_size,
                }
            )

    # Sort by title
    unwatched_items.sort(key=lambda x: x["title"].lower())
    return unwatched_items


@router.post("/unwatched-report", response_model=UnwatchedReportResponse)
def generate_unwatched_report(
    request: UnwatchedReportRequest,
    current_user: CurrentUser = Depends(require_admin),
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
    current_user: CurrentUser = Depends(require_admin),
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

    # Helper to format file size
    def format_file_size(size_bytes: Optional[int]) -> str:
        if not size_bytes:
            return "Unknown"
        # Convert to GB
        size_gb = size_bytes / (1024 ** 3)
        if size_gb >= 1000:
            # Use TB for very large sizes
            size_tb = size_gb / 1024
            return f"{size_tb:.2f} TB"
        return f"{size_gb:.2f} GB"

    # Build CSV content
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow(
        ["Title", "Year", "Type", "Library", "Added Date", "Last Watched", "Total Plays", "File Size"]
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
                format_file_size(item.get("file_size")),
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


# Copy Watch History endpoints

@router.get("/home-users", response_model=HomeUsersResponse)
def get_home_users_endpoint(
    current_user: CurrentUser = Depends(require_admin),
) -> HomeUsersResponse:
    # Get list of Plex Home users available for watch history operations
    config = load_config()
    try:
        users = get_home_users(config)
        return HomeUsersResponse(users=[HomeUser(**u) for u in users])
    except Exception as e:
        logger.error(f"Failed to get home users: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get Plex Home users. Ensure your Plex token has account access: {str(e)}"
        )


@router.post("/copy-watch-history/preview", response_model=CopyWatchHistoryPreviewResponse)
def preview_copy_watch_history(
    request: CopyWatchHistoryPreviewRequest,
    current_user: CurrentUser = Depends(require_admin),
) -> CopyWatchHistoryPreviewResponse:
    # Preview what would be changed when copying watch history
    config = load_config()

    try:
        source_server = get_server_for_user(config, request.source_user)
        target_server = get_server_for_user(config, request.target_user)
    except Exception as e:
        logger.error(f"Failed to connect to servers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to Plex: {str(e)}")

    # Get enabled libraries
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    counts = WatchHistoryPreviewCounts()
    shows_affected = set()

    for lib_name in enabled_libraries:
        try:
            source_section = source_server.library.section(lib_name)
            target_section = target_server.library.section(lib_name)

            if source_section.type == "movie":
                # Compare movie watch status by GUID
                source_movies = {m.guid: m for m in source_section.all()}
                target_movies = {m.guid: m for m in target_section.all()}

                for guid, source_movie in source_movies.items():
                    if guid in target_movies:
                        target_movie = target_movies[guid]
                        source_watched = getattr(source_movie, "isWatched", False)
                        target_watched = getattr(target_movie, "isWatched", False)

                        if source_watched and not target_watched:
                            counts.movies_to_mark_watched += 1
                        elif not source_watched and target_watched:
                            counts.movies_to_mark_unwatched += 1

            elif source_section.type == "show":
                # Compare at episode level
                source_shows = {s.guid: s for s in source_section.all()}
                target_shows = {s.guid: s for s in target_section.all()}

                for guid, source_show in source_shows.items():
                    if guid not in target_shows:
                        continue

                    target_show = target_shows[guid]
                    show_has_changes = False

                    # Get episodes and match by guid
                    source_episodes = {e.guid: e for e in source_show.episodes()}
                    target_episodes = {e.guid: e for e in target_show.episodes()}

                    for ep_guid, source_ep in source_episodes.items():
                        if ep_guid in target_episodes:
                            target_ep = target_episodes[ep_guid]
                            source_watched = getattr(source_ep, "isWatched", False)
                            target_watched = getattr(target_ep, "isWatched", False)

                            if source_watched and not target_watched:
                                counts.episodes_to_mark_watched += 1
                                show_has_changes = True
                            elif not source_watched and target_watched:
                                counts.episodes_to_mark_unwatched += 1
                                show_has_changes = True

                    if show_has_changes:
                        shows_affected.add(source_show.title)

        except Exception as e:
            logger.warning(f"Error processing library {lib_name}: {e}")
            continue

    counts.shows_affected = len(shows_affected)

    return CopyWatchHistoryPreviewResponse(
        source_user=request.source_user,
        target_user=request.target_user,
        counts=counts,
        libraries_processed=enabled_libraries,
    )


@router.post("/copy-watch-history/apply", response_model=CopyWatchHistoryApplyResponse)
def apply_copy_watch_history(
    request: CopyWatchHistoryApplyRequest,
    current_user: CurrentUser = Depends(require_admin),
) -> CopyWatchHistoryApplyResponse:
    # Apply watch history copy from source to target user
    config = load_config()

    try:
        source_server = get_server_for_user(config, request.source_user)
        target_server = get_server_for_user(config, request.target_user)
    except Exception as e:
        logger.error(f"Failed to connect to servers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to Plex: {str(e)}")

    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    movies_updated = 0
    episodes_updated = 0
    errors: List[str] = []

    for lib_name in enabled_libraries:
        try:
            source_section = source_server.library.section(lib_name)
            target_section = target_server.library.section(lib_name)

            if source_section.type == "movie":
                source_movies = {m.guid: m for m in source_section.all()}
                target_movies = {m.guid: m for m in target_section.all()}

                for guid, source_movie in source_movies.items():
                    if guid not in target_movies:
                        continue

                    target_movie = target_movies[guid]
                    source_watched = getattr(source_movie, "isWatched", False)
                    target_watched = getattr(target_movie, "isWatched", False)

                    try:
                        if source_watched and not target_watched:
                            target_movie.markPlayed()
                            movies_updated += 1
                        elif not source_watched and target_watched:
                            # Only mark unwatched in mirror mode
                            if request.conflict_mode == "mirror":
                                target_movie.markUnplayed()
                                movies_updated += 1
                    except Exception as e:
                        errors.append(f"Failed to update '{source_movie.title}': {str(e)}")

            elif source_section.type == "show":
                source_shows = {s.guid: s for s in source_section.all()}
                target_shows = {s.guid: s for s in target_section.all()}

                for guid, source_show in source_shows.items():
                    if guid not in target_shows:
                        continue

                    target_show = target_shows[guid]

                    source_episodes = {e.guid: e for e in source_show.episodes()}
                    target_episodes = {e.guid: e for e in target_show.episodes()}

                    for ep_guid, source_ep in source_episodes.items():
                        if ep_guid not in target_episodes:
                            continue

                        target_ep = target_episodes[ep_guid]
                        source_watched = getattr(source_ep, "isWatched", False)
                        target_watched = getattr(target_ep, "isWatched", False)

                        try:
                            if source_watched and not target_watched:
                                target_ep.markPlayed()
                                episodes_updated += 1
                            elif not source_watched and target_watched:
                                if request.conflict_mode == "mirror":
                                    target_ep.markUnplayed()
                                    episodes_updated += 1
                        except Exception as e:
                            errors.append(
                                f"Failed to update '{source_show.title}' - {source_ep.title}: {str(e)}"
                            )

        except Exception as e:
            errors.append(f"Failed to process library '{lib_name}': {str(e)}")

    logger.info(
        f"Copy watch history complete: {movies_updated} movies, {episodes_updated} episodes updated, {len(errors)} errors"
    )

    return CopyWatchHistoryApplyResponse(
        success=len(errors) == 0,
        movies_updated=movies_updated,
        episodes_updated=episodes_updated,
        errors=errors,
    )


@router.post("/copy-watch-history/apply-stream")
async def apply_copy_watch_history_stream(
    request: CopyWatchHistoryApplyRequest,
    req: Request,
    current_user: CurrentUser = Depends(require_admin),
):
    # SSE streaming version of apply - sends progress updates
    config = load_config()

    def generate_events():
        try:
            source_server = get_server_for_user(config, request.source_user)
            target_server = get_server_for_user(config, request.target_user)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Failed to connect to Plex: {str(e)}'})}\n\n"
            return

        enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

        movies_updated = 0
        episodes_updated = 0
        errors: List[str] = []

        for lib_idx, lib_name in enumerate(enabled_libraries):
            # Send library start event
            yield f"data: {json.dumps({'type': 'library_start', 'library': lib_name, 'library_index': lib_idx, 'total_libraries': len(enabled_libraries)})}\n\n"

            try:
                source_section = source_server.library.section(lib_name)
                target_section = target_server.library.section(lib_name)

                if source_section.type == "movie":
                    source_movies = {m.guid: m for m in source_section.all()}
                    target_movies = {m.guid: m for m in target_section.all()}
                    total_items = len(source_movies)
                    processed = 0

                    for guid, source_movie in source_movies.items():
                        processed += 1

                        # Send progress every 10 items or on last item
                        if processed % 10 == 0 or processed == total_items:
                            yield f"data: {json.dumps({'type': 'progress', 'library': lib_name, 'processed': processed, 'total': total_items, 'item_type': 'movies'})}\n\n"

                        if guid not in target_movies:
                            continue

                        target_movie = target_movies[guid]
                        source_watched = getattr(source_movie, "isWatched", False)
                        target_watched = getattr(target_movie, "isWatched", False)

                        try:
                            if source_watched and not target_watched:
                                target_movie.markPlayed()
                                movies_updated += 1
                            elif not source_watched and target_watched:
                                if request.conflict_mode == "mirror":
                                    target_movie.markUnplayed()
                                    movies_updated += 1
                        except Exception as e:
                            errors.append(f"Failed to update '{source_movie.title}': {str(e)}")

                elif source_section.type == "show":
                    source_shows = list(source_section.all())
                    target_shows = {s.guid: s for s in target_section.all()}
                    total_shows = len(source_shows)

                    for show_idx, source_show in enumerate(source_shows):
                        # Send show-level progress
                        if (show_idx + 1) % 5 == 0 or show_idx == total_shows - 1:
                            yield f"data: {json.dumps({'type': 'progress', 'library': lib_name, 'processed': show_idx + 1, 'total': total_shows, 'item_type': 'shows'})}\n\n"

                        if source_show.guid not in target_shows:
                            continue

                        target_show = target_shows[source_show.guid]

                        source_episodes = {e.guid: e for e in source_show.episodes()}
                        target_episodes = {e.guid: e for e in target_show.episodes()}

                        for ep_guid, source_ep in source_episodes.items():
                            if ep_guid not in target_episodes:
                                continue

                            target_ep = target_episodes[ep_guid]
                            source_watched = getattr(source_ep, "isWatched", False)
                            target_watched = getattr(target_ep, "isWatched", False)

                            try:
                                if source_watched and not target_watched:
                                    target_ep.markPlayed()
                                    episodes_updated += 1
                                elif not source_watched and target_watched:
                                    if request.conflict_mode == "mirror":
                                        target_ep.markUnplayed()
                                        episodes_updated += 1
                            except Exception as e:
                                errors.append(
                                    f"Failed to update '{source_show.title}' - {source_ep.title}: {str(e)}"
                                )

            except Exception as e:
                errors.append(f"Failed to process library '{lib_name}': {str(e)}")

        # Send completion event
        logger.info(
            f"Copy watch history complete: {movies_updated} movies, {episodes_updated} episodes updated, {len(errors)} errors"
        )

        yield f"data: {json.dumps({'type': 'complete', 'success': len(errors) == 0, 'movies_updated': movies_updated, 'episodes_updated': episodes_updated, 'errors': errors})}\n\n"

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
