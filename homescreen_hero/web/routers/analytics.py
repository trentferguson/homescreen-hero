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
    current_user: str = Depends(get_current_user),
) -> List[TopCollectionOut]:
    """
    Get top performing collections by play count.

    Args:
        limit: Maximum number of collections to return (default: 10)
        since_rotation_id: Optional filter for analytics since a specific rotation
        current_user: Authenticated user from dependency

    Returns:
        List of top collections with play counts
    """
    try:
        results = get_top_collections_by_plays(
            limit=limit,
            since_rotation_id=since_rotation_id,
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
