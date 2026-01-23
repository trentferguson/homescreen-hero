"""
API endpoints for managing and monitoring integrations.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ...core.auth import get_current_user
from .health import (
    _check_config,
    _check_trakt,
    _check_tautulli,
    _check_seerr,
    _check_plex,
    _check_mdblist,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/integrations", tags=["integrations"])


class IntegrationHealthOut(BaseModel):
    # Health status for a single integration

    name: str  # "Trakt", "Tautulli", etc.
    enabled: bool
    ok: bool
    status: str  # "online", "offline", "disabled", "error"
    detail: Optional[str] = None  # Error message or additional info
    last_checked: datetime = datetime.now()


class IntegrationsHealthOut(BaseModel):
    # Overall integrations health summary

    total_integrations: int
    enabled_count: int
    healthy_count: int
    unhealthy_count: int
    overall_status: str  # "all_healthy", "some_issues", "all_offline"
    integrations: List[IntegrationHealthOut]


@router.get("/health", response_model=IntegrationsHealthOut)
def get_integrations_health(
    current_user: str = Depends(get_current_user),
) -> IntegrationsHealthOut:
    # Get health status for all configured integrations
        
    component, config = _check_config()

    integrations = []

    # 1. Plex
    plex_health = _check_plex(config)
    integrations.append(
        IntegrationHealthOut(
            name="Plex",
            enabled=True,  # Plex is always required for core functionality (will need to change if Jellyfin is integrated)
            ok=plex_health.ok,
            status="online" if plex_health.ok else "error",
            detail=plex_health.error
            if not plex_health.ok
            else "; ".join(plex_health.details.get("libraries", [])),
        )
    )

    # 2. Trakt
    trakt_health = _check_trakt(config)
    trakt_enabled = bool(config.trakt and config.trakt.enabled)
    if not trakt_enabled:
        trakt_status = "disabled"
        trakt_detail = trakt_health.error or "Trakt disabled"
    elif not trakt_health.ok:
        trakt_status = "error"
        trakt_detail = trakt_health.error
    else:
        trakt_status = "online"
        trakt_detail = "Trakt OK"

    integrations.append(
        IntegrationHealthOut(
            name="Trakt",
            enabled=trakt_enabled,
            ok=trakt_health.ok or not trakt_enabled,
            status=trakt_status,
            detail=trakt_detail,
        )
    )

    # 3. Tautulli
    tautulli_health = _check_tautulli(config)
    tautulli_enabled = bool(config.tautulli and config.tautulli.enabled)
    if not tautulli_enabled:
        tautulli_status = "disabled"
        tautulli_detail = tautulli_health.error or "Tautulli disabled"
    elif not tautulli_health.ok:
        tautulli_status = "error"
        tautulli_detail = tautulli_health.error
    else:
        tautulli_status = "online"
        tautulli_detail = "Tautulli OK"

    integrations.append(
        IntegrationHealthOut(
            name="Tautulli",
            enabled=tautulli_enabled,
            ok=tautulli_health.ok or not tautulli_enabled,
            status=tautulli_status,
            detail=tautulli_detail,
        )
    )

    # 4. MDBList
    mdblist_health = _check_mdblist(config)
    mdblist_enabled = bool(config.mdblist and config.mdblist.enabled)
    if not mdblist_enabled:
        mdblist_status = "disabled"
        mdblist_detail = mdblist_health.error or "MDBList disabled"
    elif not mdblist_health.ok:
        mdblist_status = "error"
        mdblist_detail = mdblist_health.error
    else:
        mdblist_status = "online"
        mdblist_detail = "MDBList OK"

    integrations.append(
        IntegrationHealthOut(
            name="MDBList",
            enabled=mdblist_enabled,
            ok=mdblist_health.ok or not mdblist_enabled,
            status=mdblist_status,
            detail=mdblist_detail,
        )
    )

    # 5. Seerr
    seerr_health = _check_seerr(config)
    seerr_enabled = bool(config.seerr and config.seerr.enabled)
    if not seerr_enabled:
        seerr_status = "disabled"
        seerr_detail = seerr_health.error or "Seerr disabled"
    elif not seerr_health.ok:
        seerr_status = "error"
        seerr_detail = seerr_health.error
    else:
        seerr_status = "online"
        seerr_detail = "Seerr OK"

    integrations.append(
        IntegrationHealthOut(
            name="Seerr",
            enabled=seerr_enabled,
            ok=seerr_health.ok or not seerr_enabled,
            status=seerr_status,
            detail=seerr_detail,
        )
    )

    # Summarize
    enabled_integrations = [i for i in integrations if i.enabled]
    healthy_integrations = [i for i in enabled_integrations if i.ok]
    unhealthy_integrations = [i for i in enabled_integrations if not i.ok]

    overall_status = "all_healthy"
    if not healthy_integrations:
        overall_status = "all_offline"
    elif unhealthy_integrations:
        overall_status = "some_issues"

    return IntegrationsHealthOut(
        total_integrations=len(integrations),
        enabled_count=len(enabled_integrations),
        healthy_count=len(healthy_integrations),
        unhealthy_count=len(unhealthy_integrations),
        overall_status=overall_status,
        integrations=integrations,
    )
