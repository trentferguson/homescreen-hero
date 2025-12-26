from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.config.schema import (
    ClearHistoryResponse,
    CollectionUsageOut,
    RotationRecordOut,
)
from homescreen_hero.core.db import clear_history, list_rotations, list_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history")


# Return rotation history records
@router.get("/all", response_model=List[RotationRecordOut])
def get_history(limit: int = 20) -> List[RotationRecordOut]:
    logger.info("Fetching rotation history (limit=%s)", limit)

    rows = list_rotations(limit=limit)

    return [
        RotationRecordOut(
            id=r.id,
            created_at=r.created_at,
            success=r.success,
            error_message=r.error_message,
            featured_collections=r.featured_collections or [],
        )
        for r in rows
    ]


# Return usage statistics for collections
@router.get("/usage", response_model=List[CollectionUsageOut])
def get_usage() -> List[CollectionUsageOut]:
    logger.info("Fetching usage statistics")

    rows = list_usage()

    return [
        CollectionUsageOut(
            collection_name=u.collection_name,
            times_used=u.times_used,
            last_rotation_id=u.last_rotation_id,
            last_rotated_at=u.last_rotated_at,
        )
        for u in rows
    ]


# Clear all rotation history and usage statistics from database
@router.post("/clear", response_model=ClearHistoryResponse)
def clear_history_endpoint(current_user: str = Depends(get_current_user)) -> ClearHistoryResponse:
    try:
        logger.warning("Clearing rotation history on request")
        clear_history()
        return ClearHistoryResponse(
            ok=True,
            message="History cleared and reinitialized.",
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Failed to clear history")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
