"""
Analytics API endpoints for collection watch statistics.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ...core.auth import get_current_user
from ...core.config.loader import load_config
from ...core.db.analytics import (
    get_collection_analytics_history,
    get_rotation_analytics,
    get_top_collections_by_plays,
)
from ...core.integrations.tautulli_analytics import collect_analytics_for_all_active
from ...core.integrations.tautulli_client import get_tautulli_client
from ...core.integrations.plex_client import get_plex_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


# Response models
class CollectionAnalyticsOut(BaseModel):
    """Response model for collection analytics data"""

    id: int
    collection_name: str
    plex_library: str
    rating_key: Optional[int]
    total_plays: int
    total_duration_seconds: Optional[int]
    unique_users: Optional[int]
    rotation_id: Optional[int]
    collected_at: datetime
    extra_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class TopCollectionOut(BaseModel):
    """Response model for top performing collections"""

    collection_name: str
    total_plays: int
    plex_library: str
    last_collected: datetime


class AnalyticsCollectionResponse(BaseModel):
    """Response model for analytics collection trigger"""

    status: str
    message: str
    collected: List[Dict[str, Any]] = Field(default_factory=list)
    failed: List[Dict[str, Any]] = Field(default_factory=list)
    total_collections: int = 0


class ActiveUserOut(BaseModel):
    """Response model for active user statistics"""

    username: str
    total_plays: int
    total_duration: int


class ActiveStreamOut(BaseModel):
    """Response model for currently active streams"""

    user: str
    state: str  # playing, paused, buffering
    title: str
    media_type: str  # movie, episode, etc
    progress_percent: Optional[int] = None


class CurrentActivityOut(BaseModel):
    """Response model for current Plex activity"""

    stream_count: int
    streams: List[ActiveStreamOut]


class HourlyPlaysOut(BaseModel):
    """Response model for hourly play distribution"""

    hour: int
    plays: int


class DailyPlaysOut(BaseModel):
    """Response model for daily play counts"""

    date: str
    plays: int


class DailyConcurrentOut(BaseModel):
    """Response model for peak concurrent viewers by date"""

    date: str
    peak_concurrent: int


class HourlyConcurrentOut(BaseModel):
    """Response model for peak concurrent viewers by hour"""

    hour: int
    peak_concurrent: int


# Endpoints
@router.get("/collections", response_model=List[CollectionAnalyticsOut])
def get_analytics(
    collection_name: Optional[str] = None,
    limit: int = 50,
    current_user: str = Depends(get_current_user),
) -> List[CollectionAnalyticsOut]:
    """
    Get analytics history for collections.

    Args:
        collection_name: Optional filter by collection name
        limit: Maximum number of records to return (default: 50)
        current_user: Authenticated user from dependency

    Returns:
        List of analytics records
    """
    try:
        records = get_collection_analytics_history(
            collection_name=collection_name,
            limit=limit,
        )

        return [
            CollectionAnalyticsOut(
                id=record.id,
                collection_name=record.collection_name,
                plex_library=record.plex_library,
                rating_key=record.rating_key,
                total_plays=record.total_plays,
                total_duration_seconds=record.total_duration_seconds,
                unique_users=record.unique_users,
                rotation_id=record.rotation_id,
                collected_at=record.collected_at,
                extra_data=record.extra_data,
            )
            for record in records
        ]
    except Exception as e:
        logger.error(f"Failed to get analytics history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")


@router.get("/top", response_model=List[TopCollectionOut])
def get_top_collections(
    limit: int = 10,
    since_rotation_id: Optional[int] = None,
    media_type: Optional[str] = None,
    current_user: str = Depends(get_current_user),
) -> List[TopCollectionOut]:
    """
    Get top performing collections by play count.

    Args:
        limit: Maximum number of collections to return (default: 10)
        since_rotation_id: Optional filter for analytics since a specific rotation
        media_type: Optional media type filter ("movie" or "show")
        current_user: Authenticated user from dependency

    Returns:
        List of top collections with play counts
    """
    try:
        results = get_top_collections_by_plays(
            limit=limit,
            since_rotation_id=since_rotation_id,
            media_type=media_type,
        )

        return [
            TopCollectionOut(
                collection_name=result["collection_name"],
                total_plays=result["total_plays"],
                plex_library=result["plex_library"],
                last_collected=result["last_collected"],
            )
            for result in results
        ]
    except Exception as e:
        logger.error(f"Failed to get top collections: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get top collections: {str(e)}")


@router.get("/rotation/{rotation_id}", response_model=List[CollectionAnalyticsOut])
def get_rotation_analytics_endpoint(
    rotation_id: int,
    current_user: str = Depends(get_current_user),
) -> List[CollectionAnalyticsOut]:
    """
    Get analytics for a specific rotation.

    Args:
        rotation_id: The rotation ID to get analytics for
        current_user: Authenticated user from dependency

    Returns:
        List of analytics records for the rotation
    """
    try:
        records = get_rotation_analytics(rotation_id)

        return [
            CollectionAnalyticsOut(
                id=record.id,
                collection_name=record.collection_name,
                plex_library=record.plex_library,
                rating_key=record.rating_key,
                total_plays=record.total_plays,
                total_duration_seconds=record.total_duration_seconds,
                unique_users=record.unique_users,
                rotation_id=record.rotation_id,
                collected_at=record.collected_at,
                extra_data=record.extra_data,
            )
            for record in records
        ]
    except Exception as e:
        logger.error(f"Failed to get rotation analytics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to get rotation analytics: {str(e)}"
        )


@router.post("/collect", response_model=AnalyticsCollectionResponse)
def trigger_analytics_collection(
    current_user: str = Depends(get_current_user),
) -> AnalyticsCollectionResponse:
    """
    Manually trigger analytics collection for all active collections.

    This will query Tautulli for watch statistics on all currently
    active (featured) collections and store them in the database.

    Args:
        current_user: Authenticated user from dependency

    Returns:
        Summary of collection results
    """
    try:
        config = load_config()

        # Check if Tautulli is enabled
        if not config.tautulli or not config.tautulli.enabled:
            return AnalyticsCollectionResponse(
                status="skipped",
                message="Tautulli is not enabled",
                collected=[],
                failed=[],
                total_collections=0,
            )

        logger.info("Manual analytics collection triggered by user: %s", current_user)

        # Collect analytics
        result = collect_analytics_for_all_active(config)

        if result["status"] == "skipped":
            return AnalyticsCollectionResponse(
                status="skipped",
                message=result.get("reason", "Analytics collection skipped"),
                collected=result.get("collected", []),
                failed=result.get("failed", []),
                total_collections=result.get("total_collections", 0),
            )

        return AnalyticsCollectionResponse(
            status="success",
            message=f"Successfully collected analytics for {len(result['collected'])} collections",
            collected=result["collected"],
            failed=result["failed"],
            total_collections=result["total_collections"],
        )

    except Exception as e:
        logger.error(f"Failed to trigger analytics collection: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger analytics collection: {str(e)}",
        )


@router.get("/users/top", response_model=List[ActiveUserOut])
def get_most_active_users(
    limit: int = 10,
    query_days: int = 30,
    current_user: str = Depends(get_current_user),
) -> List[ActiveUserOut]:
    """
    Get most active users by watch time and play count.

    Args:
        limit: Maximum number of users to return (default: 10)
        query_days: Number of days to query (default: 30)
        current_user: Authenticated user from dependency

    Returns:
        List of active users with play counts and watch time
    """
    try:
        config = load_config()

        # Check if Tautulli is enabled
        if not config.tautulli or not config.tautulli.enabled:
            raise HTTPException(
                status_code=400,
                detail="Tautulli is not enabled or configured",
            )

        # Get Tautulli client
        tautulli = get_tautulli_client(config)
        if not tautulli:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Tautulli client",
            )

        # Use get_home_stats to get actual watch statistics
        home_stats = tautulli.get_home_stats(time_range=query_days, stats_type="plays")
        user_stats = []

        logger.info(f"Home stats type: {type(home_stats)}")

        # Handle both dict and list responses
        if isinstance(home_stats, dict):
            logger.info(f"Home stats keys: {list(home_stats.keys())}")
            # get_home_stats returns various top lists, look for top_users
            if "top_users" in home_stats:
                user_stats = home_stats["top_users"]
                logger.info(f"Retrieved {len(user_stats)} users from home_stats top_users")
                if user_stats and len(user_stats) > 0:
                    logger.info(f"Sample user data: {user_stats[0]}")
            else:
                logger.warning(f"top_users not found in home_stats. Available keys: {list(home_stats.keys())}")
        elif isinstance(home_stats, list):
            # home_stats is a list of stat groups, each with stat_id and rows
            logger.info(f"Home stats is a list with {len(home_stats)} stat groups")

            # Find the stat group with stat_id == 'top_users'
            for stat_group in home_stats:
                if isinstance(stat_group, dict):
                    stat_id = stat_group.get("stat_id")
                    logger.info(f"Found stat group: {stat_id}")

                    if stat_id == "top_users":
                        # Extract the rows array which contains the actual user data
                        user_stats = stat_group.get("rows", [])
                        logger.info(f"Found top_users stat group with {len(user_stats)} users")
                        if user_stats and len(user_stats) > 0:
                            logger.info(f"First user in top_users: {user_stats[0]}")
                        break

            if not user_stats:
                available_stats = [s.get("stat_id") for s in home_stats if isinstance(s, dict)]
                logger.warning(f"top_users stat group not found. Available stat_ids: {available_stats}")

        if not user_stats:
            logger.warning("No user statistics available from Tautulli")
            return []

        # Sort by total plays (descending) and limit
        # Note: get_home_stats top_users returns 'total_plays' and 'total_duration'
        sorted_users = sorted(
            user_stats,
            key=lambda x: int(x.get("total_plays", x.get("plays", 0))),
            reverse=True,
        )[:limit]

        # Filter out users with 0 plays
        filtered_users = [
            u for u in sorted_users
            if int(u.get("total_plays", u.get("plays", 0))) > 0
        ]

        logger.info(f"After filtering users with 0 plays: {len(filtered_users)} users remain")

        # Format response
        # get_home_stats returns: total_plays, total_duration (seconds), friendly_name/user
        result = [
            ActiveUserOut(
                username=user.get("friendly_name") or user.get("user") or user.get("username", "Unknown"),
                total_plays=int(user.get("total_plays", user.get("plays", 0))),
                total_duration=int(user.get("total_duration", user.get("total_time", user.get("duration", 0)))),
            )
            for user in filtered_users
        ]

        logger.info(f"Returning {len(result)} active users")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get most active users: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get user statistics: {str(e)}",
        )


@router.get("/activity/current", response_model=CurrentActivityOut)
def get_current_activity(
    current_user: str = Depends(get_current_user),
) -> CurrentActivityOut:
    """
    Get current active streams on Plex server.

    Returns real-time information about who is currently watching content.
    Uses Plex API directly to fetch session data.

    Args:
        current_user: Authenticated user from dependency

    Returns:
        Current activity with stream count and details
    """
    try:
        config = load_config()

        # Get Plex server connection
        try:
            server = get_plex_server(config)
        except Exception as e:
            logger.error(f"Failed to connect to Plex server: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to connect to Plex server: {str(e)}",
            )

        # Get current sessions from Plex
        sessions = server.sessions()

        # Parse sessions into streams
        streams = []
        for session in sessions:
            # Extract user info
            user = "Unknown"
            if hasattr(session, 'usernames') and session.usernames:
                user = session.usernames[0]
            elif hasattr(session, 'username') and session.username:
                user = session.username

            # Get player state
            state = "unknown"
            if hasattr(session, 'players') and session.players:
                player = session.players[0]
                if hasattr(player, 'state'):
                    state = player.state

            # Get title
            title = getattr(session, 'title', 'Unknown')

            # Determine media type
            media_type = getattr(session, 'type', 'unknown')
            if media_type == "episode":
                # For TV shows, include show name
                grandparent_title = getattr(session, 'grandparentTitle', '')
                if grandparent_title:
                    title = f"{grandparent_title} - {title}"

            # Calculate progress percentage
            progress_percent = None
            view_offset = getattr(session, 'viewOffset', None)
            duration = getattr(session, 'duration', None)
            if view_offset is not None and duration:
                try:
                    if duration > 0:
                        progress_percent = int((view_offset / duration) * 100)
                except (ValueError, TypeError, ZeroDivisionError):
                    # If conversion fails, just skip progress calculation
                    pass

            streams.append(
                ActiveStreamOut(
                    user=user,
                    state=state,
                    title=title,
                    media_type=media_type,
                    progress_percent=progress_percent,
                )
            )

        return CurrentActivityOut(
            stream_count=len(streams),
            streams=streams,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get current activity: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get current activity: {str(e)}",
        )


@router.get("/graph/plays-by-hour", response_model=List[HourlyPlaysOut])
def get_plays_by_hour(
    query_days: int = 30,
    current_user: str = Depends(get_current_user),
) -> List[HourlyPlaysOut]:
    """
    Get play counts grouped by hour of day for graphing.

    Args:
        query_days: Number of days to query (default: 30)
        current_user: Authenticated user from dependency

    Returns:
        List of hourly play counts (0-23 hours)
    """
    try:
        config = load_config()

        if not config.tautulli or not config.tautulli.enabled:
            raise HTTPException(
                status_code=400,
                detail="Tautulli is not enabled or configured",
            )

        tautulli = get_tautulli_client(config)
        if not tautulli:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Tautulli client",
            )

        data = tautulli.get_plays_by_hourofday(time_range=query_days)

        if not data:
            # Return empty array for all 24 hours if no data
            return [HourlyPlaysOut(hour=h, plays=0) for h in range(24)]

        # Tautulli returns data in categories/series format
        # We need to parse it into a simple hour -> plays mapping
        result = []

        # Handle different response formats from Tautulli
        if isinstance(data, dict):
            categories = data.get("categories", [])
            series = data.get("series", [])

            # Find the series with plays data
            plays_data = []
            for s in series:
                if s.get("name") in ["Movies", "TV", "Plays", "plays"]:
                    plays_data = s.get("data", [])
                    break

            # If we didn't find specific series, sum all series
            if not plays_data and series:
                # Sum all series data
                total_by_hour = {}
                for s in series:
                    for i, val in enumerate(s.get("data", [])):
                        total_by_hour[i] = total_by_hour.get(i, 0) + (val or 0)
                plays_data = [total_by_hour.get(i, 0) for i in range(len(categories))]

            for i, hour_label in enumerate(categories):
                # Parse hour from label (e.g., "00", "01", "12")
                try:
                    hour = int(hour_label)
                except ValueError:
                    hour = i
                plays = plays_data[i] if i < len(plays_data) else 0
                result.append(HourlyPlaysOut(hour=hour, plays=plays or 0))
        elif isinstance(data, list):
            # Direct list format
            for item in data:
                if isinstance(item, dict):
                    result.append(HourlyPlaysOut(
                        hour=int(item.get("hour", 0)),
                        plays=int(item.get("plays", item.get("total_plays", 0))),
                    ))

        # Ensure we have all 24 hours
        if len(result) < 24:
            existing_hours = {r.hour for r in result}
            for h in range(24):
                if h not in existing_hours:
                    result.append(HourlyPlaysOut(hour=h, plays=0))

        # Sort by hour
        result.sort(key=lambda x: x.hour)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get plays by hour: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get hourly play statistics: {str(e)}",
        )


@router.get("/graph/plays-by-date", response_model=List[DailyPlaysOut])
def get_plays_by_date(
    query_days: int = 30,
    current_user: str = Depends(get_current_user),
) -> List[DailyPlaysOut]:
    """
    Get play counts grouped by date for graphing.

    Args:
        query_days: Number of days to query (default: 30)
        current_user: Authenticated user from dependency

    Returns:
        List of daily play counts
    """
    try:
        config = load_config()

        if not config.tautulli or not config.tautulli.enabled:
            raise HTTPException(
                status_code=400,
                detail="Tautulli is not enabled or configured",
            )

        tautulli = get_tautulli_client(config)
        if not tautulli:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Tautulli client",
            )

        data = tautulli.get_plays_by_date(time_range=query_days)

        if not data:
            return []

        result = []

        # Handle different response formats from Tautulli
        if isinstance(data, dict):
            categories = data.get("categories", [])
            series = data.get("series", [])

            # Sum all series data (Movies + TV, etc.)
            total_by_date = {}
            for s in series:
                for i, val in enumerate(s.get("data", [])):
                    total_by_date[i] = total_by_date.get(i, 0) + (val or 0)

            for i, date_label in enumerate(categories):
                plays = total_by_date.get(i, 0)
                result.append(DailyPlaysOut(date=date_label, plays=plays))
        elif isinstance(data, list):
            # Direct list format
            for item in data:
                if isinstance(item, dict):
                    result.append(DailyPlaysOut(
                        date=item.get("date", ""),
                        plays=int(item.get("plays", item.get("total_plays", 0))),
                    ))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get plays by date: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get daily play statistics: {str(e)}",
        )


@router.get("/graph/concurrent-by-date", response_model=List[DailyConcurrentOut])
def get_concurrent_by_date(
    query_days: int = 30,
    current_user: str = Depends(get_current_user),
) -> List[DailyConcurrentOut]:
    """
    Get peak concurrent viewer counts by date.

    Uses watch history to calculate the maximum number of concurrent streams
    for each day over the specified time period.

    Args:
        query_days: Number of days to query (default: 30)
        current_user: Authenticated user from dependency

    Returns:
        List of peak concurrent viewer counts for each day
    """
    try:
        config = load_config()

        if not config.tautulli or not config.tautulli.enabled:
            raise HTTPException(
                status_code=400,
                detail="Tautulli is not enabled or configured",
            )

        tautulli = get_tautulli_client(config)
        if not tautulli:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Tautulli client",
            )

        # Get history data to calculate concurrent viewers
        # We need enough data to cover the time range
        history = tautulli.get_history(length=10000)

        if not history:
            return []

        # Filter by time range and calculate concurrent viewers by date
        from datetime import datetime
        import time

        cutoff_time = time.time() - (query_days * 24 * 60 * 60)

        # Collect all sessions within the time range
        sessions: List[Dict[str, Any]] = []

        for entry in history:
            started = entry.get("started")
            stopped = entry.get("stopped")

            if not started:
                continue

            # Filter by time range
            if started < cutoff_time:
                continue

            sessions.append({
                "started": started,
                "stopped": stopped or started + 3600,  # Default 1 hour if no stop time
                "date": datetime.fromtimestamp(started).strftime("%Y-%m-%d"),
            })

        if not sessions:
            return []

        # Group sessions by date
        sessions_by_date: Dict[str, List[Dict[str, Any]]] = {}
        for session in sessions:
            date = session["date"]
            if date not in sessions_by_date:
                sessions_by_date[date] = []
            sessions_by_date[date].append(session)

        # Calculate peak concurrent for each date
        result = []
        for date in sorted(sessions_by_date.keys()):
            day_sessions = sessions_by_date[date]

            # Find peak concurrent by checking at each session start and stop time
            # Create a list of events (start = +1, stop = -1)
            events: List[tuple] = []
            for s in day_sessions:
                events.append((s["started"], 1))  # Session starts
                events.append((s["stopped"], -1))  # Session ends

            # Sort events by time
            events.sort(key=lambda x: (x[0], -x[1]))  # Process starts before stops at same time

            # Calculate peak concurrent
            current_concurrent = 0
            peak = 0
            for _, delta in events:
                current_concurrent += delta
                peak = max(peak, current_concurrent)

            result.append(DailyConcurrentOut(date=date, peak_concurrent=peak))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get concurrent viewers by date: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get concurrent viewer statistics: {str(e)}",
        )


@router.get("/graph/concurrent-by-hour", response_model=List[HourlyConcurrentOut])
def get_concurrent_by_hour(
    current_user: str = Depends(get_current_user),
) -> List[HourlyConcurrentOut]:
    """
    Get peak concurrent viewer counts by hour for the last 24 hours.

    Uses watch history to calculate the maximum number of concurrent streams
    for each hour of the last 24 hours.

    Args:
        current_user: Authenticated user from dependency

    Returns:
        List of peak concurrent viewer counts for each hour (0-23)
    """
    try:
        config = load_config()

        if not config.tautulli or not config.tautulli.enabled:
            raise HTTPException(
                status_code=400,
                detail="Tautulli is not enabled or configured",
            )

        tautulli = get_tautulli_client(config)
        if not tautulli:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Tautulli client",
            )

        # Get history data for the last 24 hours
        history = tautulli.get_history(length=1000)

        if not history:
            return [HourlyConcurrentOut(hour=h, peak_concurrent=0) for h in range(24)]

        from datetime import datetime
        import time

        # Only look at the last 24 hours
        cutoff_time = time.time() - (24 * 60 * 60)

        # Collect all sessions within the last 24 hours
        sessions: List[Dict[str, Any]] = []

        for entry in history:
            started = entry.get("started")
            stopped = entry.get("stopped")

            if not started:
                continue

            # Filter to last 24 hours
            if started < cutoff_time:
                continue

            sessions.append({
                "started": started,
                "stopped": stopped or started + 3600,  # Default 1 hour if no stop time
            })

        if not sessions:
            return [HourlyConcurrentOut(hour=h, peak_concurrent=0) for h in range(24)]

        # For each hour, find the peak concurrent streams
        result = []
        now = time.time()

        for hour in range(24):
            # Calculate the time window for this hour (going back from now)
            # Hour 0 = most recent hour, Hour 23 = 23 hours ago
            # But we want to display it as actual clock hours, so we need to map differently

            # Get sessions that overlap with this clock hour in the last 24 hours
            hour_sessions = []
            for s in sessions:
                start_dt = datetime.fromtimestamp(s["started"])
                stop_dt = datetime.fromtimestamp(s["stopped"])

                # Check if session overlaps with this clock hour
                session_start_hour = start_dt.hour
                session_stop_hour = stop_dt.hour

                # A session overlaps with hour H if it started before H ends and stopped after H starts
                # For simplicity, include session if it was active during this hour
                if session_start_hour <= hour <= session_stop_hour or session_start_hour == hour:
                    hour_sessions.append(s)

            if not hour_sessions:
                result.append(HourlyConcurrentOut(hour=hour, peak_concurrent=0))
                continue

            # Calculate peak concurrent for this hour using event-based algorithm
            events: List[tuple] = []
            for s in hour_sessions:
                events.append((s["started"], 1))
                events.append((s["stopped"], -1))

            events.sort(key=lambda x: (x[0], -x[1]))

            current_concurrent = 0
            peak = 0
            for _, delta in events:
                current_concurrent += delta
                peak = max(peak, current_concurrent)

            result.append(HourlyConcurrentOut(hour=hour, peak_concurrent=peak))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get concurrent viewers by hour: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get hourly concurrent viewer statistics: {str(e)}",
        )
