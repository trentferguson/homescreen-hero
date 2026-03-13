from __future__ import annotations

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends

from homescreen_hero.core.auth import CurrentUser, get_current_user, require_admin
from homescreen_hero.core.config.schema import (
    ClearHistoryResponse,
    CollectionUsageOut,
    RotationRecordOut,
)
from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.db import clear_history, list_rotations, list_usage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history")


# Return rotation history records
@router.get("/all", response_model=List[RotationRecordOut])
def get_history(limit: int = 20) -> List[RotationRecordOut]:
    logger.debug("Fetching rotation history (limit=%s)", limit)

    rows = list_rotations(limit=limit)

    return [
        RotationRecordOut(
            id=r.id,
            created_at=r.created_at,
            success=r.success,
            error_message=r.error_message,
            featured_collections=r.featured_collections or [],
            group_contributions=r.group_contributions,
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
def clear_history_endpoint(current_user: CurrentUser = Depends(require_admin)) -> ClearHistoryResponse:
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


# Return the most recent rotation timestamp for each group
@router.get("/group-last-rotated")
def get_group_last_rotated() -> Dict[str, Optional[str]]:
    config = load_config()

    # Initialize all groups with None
    result: Dict[str, Optional[str]] = {g.name: None for g in config.groups}

    # Walk rotation history (most recent first) and find the latest timestamp per group
    rows = list_rotations(limit=100)
    groups_found: set[str] = set()

    for record in rows:
        if not record.group_contributions:
            continue
        for group_name in record.group_contributions:
            if group_name in result and group_name not in groups_found:
                result[group_name] = record.created_at.isoformat() + "Z"
                groups_found.add(group_name)
        # Stop early if we've found all groups
        if len(groups_found) >= len(result):
            break

    return result
