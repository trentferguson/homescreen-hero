from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.seerr_client import get_seerr_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/seerr", tags=["seerr"])


# Response Models
class SeerrRequestedBy(BaseModel):
    username: str
    avatar: Optional[str] = None


class SeerrMedia(BaseModel):
    mediaType: str  # "movie" or "tv"
    title: str
    posterPath: Optional[str] = None


class SeerrRequestOut(BaseModel):
    id: int
    media: SeerrMedia
    status: int  # 1=PENDING, 2=APPROVED, 3=DECLINED, 4=AVAILABLE
    statusLabel: str
    createdAt: str
    requestedBy: SeerrRequestedBy


class SeerrRequestsResponse(BaseModel):
    requests: List[SeerrRequestOut]
    totalResults: int


class SeerrMediaDetail(BaseModel):
    mediaType: str
    title: str
    posterPath: Optional[str] = None
    backdropPath: Optional[str] = None
    overview: Optional[str] = None
    releaseDate: Optional[str] = None
    voteAverage: Optional[float] = None
    tmdbId: Optional[int] = None


class SeerrRequestDetail(BaseModel):
    id: int
    media: SeerrMediaDetail
    status: int
    statusLabel: str
    createdAt: str
    updatedAt: Optional[str] = None
    requestedBy: SeerrRequestedBy


# Request status (request.status)
REQUEST_STATUS_PENDING = 1
REQUEST_STATUS_APPROVED = 2
REQUEST_STATUS_DECLINED = 3

# Media status (request.media.status) - indicates availability
MEDIA_STATUS_UNKNOWN = 1
MEDIA_STATUS_PENDING = 2
MEDIA_STATUS_PROCESSING = 3
MEDIA_STATUS_PARTIALLY_AVAILABLE = 4
MEDIA_STATUS_AVAILABLE = 5

# Display status codes for frontend (our own numbering)
DISPLAY_STATUS_PENDING = 1
DISPLAY_STATUS_APPROVED = 2
DISPLAY_STATUS_DECLINED = 3
DISPLAY_STATUS_AVAILABLE = 4
DISPLAY_STATUS_PROCESSING = 5
DISPLAY_STATUS_PARTIALLY_AVAILABLE = 6

DISPLAY_STATUS_LABELS = {
    DISPLAY_STATUS_PENDING: "Pending",
    DISPLAY_STATUS_APPROVED: "Approved",
    DISPLAY_STATUS_DECLINED: "Declined",
    DISPLAY_STATUS_AVAILABLE: "Available",
    DISPLAY_STATUS_PROCESSING: "Processing",
    DISPLAY_STATUS_PARTIALLY_AVAILABLE: "Partially Available",
}


def compute_display_status(request_status: int, media_status: int) -> int:
    # Compute a display status from request status and media status
    # If request is pending or declined, show that
    # If request is approved, show availability (but treat "processing" as approved
    # since Overseerr uses "processing" for monitored/unreleased items too)
    if request_status == REQUEST_STATUS_PENDING:
        return DISPLAY_STATUS_PENDING
    if request_status == REQUEST_STATUS_DECLINED:
        return DISPLAY_STATUS_DECLINED

    # Request is approved - show media availability
    if media_status == MEDIA_STATUS_AVAILABLE:
        return DISPLAY_STATUS_AVAILABLE
    if media_status == MEDIA_STATUS_PARTIALLY_AVAILABLE:
        return DISPLAY_STATUS_PARTIALLY_AVAILABLE

    # Approved but not yet available (including "processing"/monitored items)
    return DISPLAY_STATUS_APPROVED


@router.get("/requests", response_model=SeerrRequestsResponse)
def get_seerr_requests(
    take: int = 5,
    skip: int = 0,
    filter: Optional[str] = None,
    current_user: str = Depends(get_current_user),
) -> SeerrRequestsResponse:
    # Get recent Seerr requests with optional status filter
    # filter values: "all", "pending", "approved", "available", "processing", etc.
    try:
        config = load_config()

        if not config.seerr or not config.seerr.enabled:
            raise HTTPException(
                status_code=400,
                detail="Seerr is not enabled or configured",
            )

        client = get_seerr_client(config)
        if not client:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Seerr client",
            )

        data = client.get_requests(
            take=take,
            skip=skip,
            filter_status=filter if filter and filter != "all" else None,
        )

        results = data.get("results", [])
        page_info = data.get("pageInfo", {})

        # Log first result to debug structure
        if results:
            logger.debug("Seerr request sample: %s", results[0])

        requests = []
        for r in results:
            media = r.get("media", {}) or {}
            requested_by = r.get("requestedBy", {}) or {}

            # Get both request status and media status
            request_status = r.get("status", 1)
            media_status = media.get("status", 1)

            # Compute display status from both
            display_status = compute_display_status(request_status, media_status)

            # Determine media type from request
            media_type = r.get("type") or media.get("mediaType") or "unknown"
            tmdb_id = media.get("tmdbId")

            # Fetch actual title from movie/TV details endpoint
            title = "Unknown"
            poster_path = None
            if tmdb_id:
                if media_type == "movie":
                    movie_data = client.get_movie(tmdb_id)
                    title = movie_data.get("title") or movie_data.get("originalTitle") or "Unknown"
                    poster_path = movie_data.get("posterPath")
                elif media_type == "tv":
                    tv_data = client.get_tv(tmdb_id)
                    # TV shows use "name" instead of "title"
                    title = tv_data.get("name") or tv_data.get("originalName") or "Unknown"
                    poster_path = tv_data.get("posterPath")

            # Handle cases where requestedBy might be None or missing username
            username = None
            if requested_by:
                username = (
                    requested_by.get("username")
                    or requested_by.get("displayName")
                    or requested_by.get("plexUsername")
                    or requested_by.get("email")
                )
            if not username:
                username = "System"

            requests.append(SeerrRequestOut(
                id=r.get("id", 0),
                media=SeerrMedia(
                    mediaType=media_type if media_type in ("movie", "tv") else "unknown",
                    title=title,
                    posterPath=poster_path,
                ),
                status=display_status,
                statusLabel=DISPLAY_STATUS_LABELS.get(display_status, "Unknown"),
                createdAt=r.get("createdAt", ""),
                requestedBy=SeerrRequestedBy(
                    username=username,
                    avatar=requested_by.get("avatar") if requested_by else None,
                ),
            ))

        return SeerrRequestsResponse(
            requests=requests,
            totalResults=page_info.get("totalResults", len(requests)),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get Seerr requests: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get Seerr requests: {str(e)}",
        )


@router.post("/requests/{request_id}/approve")
def approve_seerr_request(
    request_id: int,
    current_user: str = Depends(get_current_user),
) -> dict:
    # Approve a pending Seerr request
    try:
        config = load_config()

        if not config.seerr or not config.seerr.enabled:
            raise HTTPException(
                status_code=400,
                detail="Seerr is not enabled or configured",
            )

        client = get_seerr_client(config)
        if not client:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Seerr client",
            )

        success, error = client.approve_request(request_id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail=error or "Failed to approve request",
            )

        return {"success": True, "message": f"Request {request_id} approved"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to approve Seerr request %s: %s", request_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to approve request: {str(e)}",
        )


@router.post("/requests/{request_id}/decline")
def decline_seerr_request(
    request_id: int,
    current_user: str = Depends(get_current_user),
) -> dict:
    # Decline a pending Seerr request
    try:
        config = load_config()

        if not config.seerr or not config.seerr.enabled:
            raise HTTPException(
                status_code=400,
                detail="Seerr is not enabled or configured",
            )

        client = get_seerr_client(config)
        if not client:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Seerr client",
            )

        success, error = client.decline_request(request_id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail=error or "Failed to decline request",
            )

        return {"success": True, "message": f"Request {request_id} declined"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to decline Seerr request %s: %s", request_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to decline request: {str(e)}",
        )


@router.delete("/requests/{request_id}")
def delete_seerr_request(
    request_id: int,
    current_user: str = Depends(get_current_user),
) -> dict:
    # Delete a Seerr request
    try:
        config = load_config()

        if not config.seerr or not config.seerr.enabled:
            raise HTTPException(
                status_code=400,
                detail="Seerr is not enabled or configured",
            )

        client = get_seerr_client(config)
        if not client:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Seerr client",
            )

        success, error = client.delete_request(request_id)

        if not success:
            raise HTTPException(
                status_code=400,
                detail=error or "Failed to delete request",
            )

        return {"success": True, "message": f"Request {request_id} deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete Seerr request %s: %s", request_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete request: {str(e)}",
        )


@router.get("/requests/{request_id}", response_model=SeerrRequestDetail)
def get_seerr_request_detail(
    request_id: int,
    current_user: str = Depends(get_current_user),
) -> SeerrRequestDetail:
    # Get detailed info for a single Seerr request
    try:
        config = load_config()

        if not config.seerr or not config.seerr.enabled:
            raise HTTPException(
                status_code=400,
                detail="Seerr is not enabled or configured",
            )

        client = get_seerr_client(config)
        if not client:
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize Seerr client",
            )

        r = client.get_request(request_id)
        if not r:
            raise HTTPException(
                status_code=404,
                detail=f"Request {request_id} not found",
            )

        media = r.get("media", {}) or {}
        requested_by = r.get("requestedBy", {}) or {}

        request_status = r.get("status", 1)
        media_status = media.get("status", 1)
        display_status = compute_display_status(request_status, media_status)

        media_type = r.get("type") or media.get("mediaType") or "unknown"
        tmdb_id = media.get("tmdbId")

        # Fetch full media details
        title = "Unknown"
        poster_path = None
        backdrop_path = None
        overview = None
        release_date = None
        vote_average = None

        if tmdb_id:
            if media_type == "movie":
                movie_data = client.get_movie(tmdb_id)
                title = movie_data.get("title") or movie_data.get("originalTitle") or "Unknown"
                poster_path = movie_data.get("posterPath")
                backdrop_path = movie_data.get("backdropPath")
                overview = movie_data.get("overview")
                release_date = movie_data.get("releaseDate")
                vote_average = movie_data.get("voteAverage")
            elif media_type == "tv":
                tv_data = client.get_tv(tmdb_id)
                title = tv_data.get("name") or tv_data.get("originalName") or "Unknown"
                poster_path = tv_data.get("posterPath")
                backdrop_path = tv_data.get("backdropPath")
                overview = tv_data.get("overview")
                release_date = tv_data.get("firstAirDate")
                vote_average = tv_data.get("voteAverage")

        # Get username
        username = None
        if requested_by:
            username = (
                requested_by.get("username")
                or requested_by.get("displayName")
                or requested_by.get("plexUsername")
                or requested_by.get("email")
            )
        if not username:
            username = "System"

        return SeerrRequestDetail(
            id=r.get("id", 0),
            media=SeerrMediaDetail(
                mediaType=media_type if media_type in ("movie", "tv") else "unknown",
                title=title,
                posterPath=poster_path,
                backdropPath=backdrop_path,
                overview=overview,
                releaseDate=release_date,
                voteAverage=vote_average,
                tmdbId=tmdb_id,
            ),
            status=display_status,
            statusLabel=DISPLAY_STATUS_LABELS.get(display_status, "Unknown"),
            createdAt=r.get("createdAt", ""),
            updatedAt=r.get("updatedAt"),
            requestedBy=SeerrRequestedBy(
                username=username,
                avatar=requested_by.get("avatar") if requested_by else None,
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get Seerr request %s: %s", request_id, e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get request: {str(e)}",
        )
