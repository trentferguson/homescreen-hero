from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.auth import CurrentUser, require_admin
from homescreen_hero.core.user_targeting import get_targetable_users, sync_all_user_filters, clear_all_targeting


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["user-targeting"])


class PlexUserResponse(BaseModel):
    id: int
    username: str
    title: str
    thumb: Optional[str]
    is_home: bool
    is_admin: bool


class PlexUsersListResponse(BaseModel):
    users: List[PlexUserResponse]


class SyncResult(BaseModel):
    status: str
    message: str


class ClearTargetingResult(BaseModel):
    status: str
    labels_removed: int
    collections_cleaned: int
    filters_cleaned: int


@router.get("/plex-users", response_model=PlexUsersListResponse)
def list_plex_users(
    current_user: CurrentUser = Depends(require_admin),
) -> PlexUsersListResponse:
    # List all Plex users available for targeting (friends + home)
    config = load_config()
    try:
        users = get_targetable_users(config)
        return PlexUsersListResponse(
            users=[PlexUserResponse(**u) for u in users]
        )
    except Exception as e:
        logger.error(f"Failed to fetch Plex users: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user-targeting/sync", response_model=SyncResult)
def sync_user_filters(
    current_user: CurrentUser = Depends(require_admin),
) -> SyncResult:
    # Force sync of all user filter settings
    config = load_config()
    try:
        sync_all_user_filters(config)
        return SyncResult(status="ok", message="User filters synced successfully")
    except Exception as e:
        logger.error(f"Failed to sync user filters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user-targeting/clear-all", response_model=ClearTargetingResult)
def clear_all_user_targeting(
    current_user: CurrentUser = Depends(require_admin),
) -> ClearTargetingResult:
    # Remove all hsh-hide labels from collections and clean filters for all users
    config = load_config()
    try:
        result = clear_all_targeting(config)
        return ClearTargetingResult(status="ok", **result)
    except Exception as e:
        logger.error(f"Failed to clear targeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))
