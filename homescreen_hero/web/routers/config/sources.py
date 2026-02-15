from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.config.loader import (
    CONFIG_ENV_VAR,
    get_config_path,
    load_config,
)
from homescreen_hero.core.config.schema import (
    TraktSource,
    LetterboxdSource,
    MDBListSource,
    AniListSource,
)
from homescreen_hero.core.integrations.plex_client import get_plex_server

from .helpers import (
    load_config_mapping,
    save_config_mapping,
    load_trakt_sources,
    load_letterboxd_sources,
    load_mdblist_sources,
    load_anilist_sources,
)
from .schemas import (
    ConfigSaveResponse,
    TraktSourcePayload,
    TraktSourceStatus,
    TraktSyncResponse,
    TraktMissingItemOut,
    LetterboxdSourcePayload,
    LetterboxdSourceStatus,
    LetterboxdSyncResponse,
    LetterboxdMissingItemOut,
    MDBListSourcePayload,
    MDBListSourceStatus,
    MDBListSyncResponse,
    MDBListMissingItemOut,
    AniListSourcePayload,
    AniListSourceStatus,
    AniListSyncResponse,
    AniListMissingItemOut,
)

import os

logger = logging.getLogger(__name__)

router = APIRouter()


# ========================================================================
# TRAKT SOURCES
# ========================================================================

@router.get("/trakt/sources", response_model=list[TraktSource])
def list_trakt_sources(current_user: str = Depends(get_current_user)) -> list[TraktSource]:
    # Return list of all configured Trakt sources
    try:
        config = load_config()
        return list(getattr(getattr(config, "trakt", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/trakt/sources", response_model=ConfigSaveResponse)
def create_trakt_source(
    payload: TraktSourcePayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Append new Trakt source to config.yaml
    try:
        data = load_config_mapping()
        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

        sources = load_trakt_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        trakt_section["sources"] = sources
        data["trakt"] = trakt_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Trakt source '{payload.name}' added.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/trakt/sources/{index}", response_model=ConfigSaveResponse)
def update_trakt_source(
    index: int,
    payload: TraktSourcePayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    # Replace existing Trakt source at given index in config.yaml
    try:
        data = load_config_mapping()
        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

        sources = load_trakt_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        trakt_section["sources"] = sources
        data["trakt"] = trakt_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Trakt source '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/trakt/sources/{index}", response_model=ConfigSaveResponse)
def delete_trakt_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Remove Trakt source at given index from config.yaml
    try:
        data = load_config_mapping()
        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

        sources = load_trakt_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        removed = sources.pop(index)
        trakt_section["sources"] = sources
        data["trakt"] = trakt_section

        save_config_mapping(data)

        name = removed.get("name") if isinstance(removed, dict) else None
        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Trakt source '{name or index}' deleted.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/trakt/sources/status", response_model=list[TraktSourceStatus])
def get_trakt_sources_status(
    current_user: str = Depends(get_current_user)
) -> list[TraktSourceStatus]:
    # Return sync status for each configured Trakt source.
    try:
        config = load_config()
        sources = list(getattr(getattr(config, "trakt", None), "sources", []) or [])

        # For now, return basic status without historical sync data
        # Future enhancement: query database for actual sync history
        statuses: list[TraktSourceStatus] = []
        for idx, source in enumerate(sources):
            statuses.append(
                TraktSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=None,
                    sync_status="never_synced",
                    error_message=None,
                    items_matched=0,
                    items_total=0,
                )
            )

        return statuses
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/trakt/sources/{index}/sync", response_model=TraktSyncResponse)
def sync_trakt_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> TraktSyncResponse:
    # Manually sync a specific Trakt source to Plex collection.
    try:
        from homescreen_hero.core.integrations.trakt_sync import sync_single_trakt_source

        config = load_config()
        sources = list(getattr(getattr(config, "trakt", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_trakt_source(server, config, source)
        missing = total - matched

        return TraktSyncResponse(
            ok=True,
            message=f"Synced '{source.name}' successfully",
            items_total=total,
            items_matched=matched,
            items_missing=missing,
            sync_time=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error syncing Trakt source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/trakt/sources/{index}/missing", response_model=list[TraktMissingItemOut])
def get_missing_items_for_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> list[TraktMissingItemOut]:
    # Get items from a Trakt list that weren't found in Plex.
    try:
        from homescreen_hero.core.db import get_session
        from homescreen_hero.core.db.models import TraktMissingItem

        config = load_config()
        sources = list(getattr(getattr(config, "trakt", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        source = sources[index]

        # Query database for missing items from this source
        with get_session() as session:
            results = session.query(TraktMissingItem).filter(
                TraktMissingItem.source_name == source.name,
                TraktMissingItem.source_url == source.url
            ).order_by(TraktMissingItem.last_seen.desc()).all()

            # Convert to response model
            return [
                TraktMissingItemOut(
                    title=item.title,
                    year=item.year,
                    trakt_id=item.trakt_id,
                    slug=item.slug,
                    imdb_id=item.imdb_id,
                    tmdb_id=item.tmdb_id,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    times_seen=item.times_seen,
                )
                for item in results
            ]
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Error fetching missing items for source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# LETTERBOXD SOURCES
# ========================================================================

@router.get("/letterboxd/sources", response_model=list[LetterboxdSource])
def list_letterboxd_sources(current_user: str = Depends(get_current_user)) -> list[LetterboxdSource]:
    # Return list of all configured Letterboxd sources
    try:
        config = load_config()
        return list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/letterboxd/sources", response_model=ConfigSaveResponse)
def create_letterboxd_source(
    payload: LetterboxdSourcePayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Append new Letterboxd source to config.yaml
    try:
        data = load_config_mapping()
        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        sources = load_letterboxd_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        letterboxd_section["sources"] = sources
        data["letterboxd"] = letterboxd_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Letterboxd source '{payload.name}' added.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/letterboxd/sources/{index}", response_model=ConfigSaveResponse)
def update_letterboxd_source(
    index: int,
    payload: LetterboxdSourcePayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    # Replace existing Letterboxd source at given index in config.yaml
    try:
        data = load_config_mapping()
        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        sources = load_letterboxd_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        letterboxd_section["sources"] = sources
        data["letterboxd"] = letterboxd_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Letterboxd source '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/letterboxd/sources/{index}", response_model=ConfigSaveResponse)
def delete_letterboxd_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Remove Letterboxd source at given index from config.yaml
    try:
        data = load_config_mapping()
        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        sources = load_letterboxd_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        removed = sources.pop(index)
        letterboxd_section["sources"] = sources
        data["letterboxd"] = letterboxd_section

        save_config_mapping(data)

        name = removed.get("name") if isinstance(removed, dict) else None
        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Letterboxd source '{name or index}' deleted.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/letterboxd/sources/status", response_model=list[LetterboxdSourceStatus])
def get_letterboxd_sources_status(
    current_user: str = Depends(get_current_user)
) -> list[LetterboxdSourceStatus]:
    # Return sync status for each configured Letterboxd source.
    try:
        config = load_config()
        sources = list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])

        # For now, return basic status without historical sync data
        # Future enhancement: query database for actual sync history
        statuses: list[LetterboxdSourceStatus] = []
        for idx, source in enumerate(sources):
            statuses.append(
                LetterboxdSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=None,
                    sync_status="never_synced",
                    error_message=None,
                    items_matched=0,
                    items_total=0,
                )
            )

        return statuses
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/letterboxd/sources/{index}/sync", response_model=LetterboxdSyncResponse)
def sync_letterboxd_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> LetterboxdSyncResponse:
    # Manually sync a specific Letterboxd source to Plex collection.
    try:
        from homescreen_hero.core.integrations.letterboxd_sync import sync_single_letterboxd_source

        config = load_config()
        sources = list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_letterboxd_source(server, config, source)
        missing = total - matched

        return LetterboxdSyncResponse(
            ok=True,
            message=f"Synced '{source.name}' successfully",
            items_total=total,
            items_matched=matched,
            items_missing=missing,
            sync_time=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error syncing Letterboxd source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/letterboxd/sources/{index}/missing", response_model=list[LetterboxdMissingItemOut])
def get_missing_items_for_letterboxd_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> list[LetterboxdMissingItemOut]:
    # Get items from a Letterboxd list that weren't found in Plex.
    try:
        from homescreen_hero.core.db import get_session
        from homescreen_hero.core.db.models import LetterboxdMissingItem

        config = load_config()
        sources = list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        source = sources[index]

        # Query database for missing items from this source
        with get_session() as session:
            results = session.query(LetterboxdMissingItem).filter(
                LetterboxdMissingItem.source_name == source.name,
                LetterboxdMissingItem.source_url == source.url
            ).order_by(LetterboxdMissingItem.last_seen.desc()).all()

            # Convert to response model
            return [
                LetterboxdMissingItemOut(
                    title=item.title,
                    year=item.year,
                    slug=item.slug,
                    letterboxd_url=item.letterboxd_url,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    times_seen=item.times_seen,
                )
                for item in results
            ]
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Error fetching missing items for Letterboxd source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# MDBLIST SOURCES
# ========================================================================

@router.get("/mdblist/sources", response_model=list[MDBListSource])
def list_mdblist_sources(current_user: str = Depends(get_current_user)) -> list[MDBListSource]:
    # Return list of all configured MDBList sources
    try:
        config = load_config()
        return list(getattr(getattr(config, "mdblist", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mdblist/sources", response_model=ConfigSaveResponse)
def create_mdblist_source(
    payload: MDBListSourcePayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Append new MDBList source to config.yaml
    try:
        data = load_config_mapping()
        mdblist_section = data.get("mdblist") if isinstance(data.get("mdblist"), dict) else {}
        mdblist_section = dict(mdblist_section)

        sources = load_mdblist_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        mdblist_section["sources"] = sources
        data["mdblist"] = mdblist_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"MDBList source '{payload.name}' added.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/mdblist/sources/{index}", response_model=ConfigSaveResponse)
def update_mdblist_source(
    index: int,
    payload: MDBListSourcePayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    # Replace existing MDBList source at given index in config.yaml
    try:
        data = load_config_mapping()
        mdblist_section = data.get("mdblist") if isinstance(data.get("mdblist"), dict) else {}
        mdblist_section = dict(mdblist_section)

        sources = load_mdblist_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MDBList source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        mdblist_section["sources"] = sources
        data["mdblist"] = mdblist_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"MDBList source '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/mdblist/sources/{index}", response_model=ConfigSaveResponse)
def delete_mdblist_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Remove MDBList source at given index from config.yaml
    try:
        data = load_config_mapping()
        mdblist_section = data.get("mdblist") if isinstance(data.get("mdblist"), dict) else {}
        mdblist_section = dict(mdblist_section)

        sources = load_mdblist_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MDBList source not found")

        removed = sources.pop(index)
        mdblist_section["sources"] = sources
        data["mdblist"] = mdblist_section

        save_config_mapping(data)

        name = removed.get("name") if isinstance(removed, dict) else None
        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"MDBList source '{name or index}' deleted.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/mdblist/sources/status", response_model=list[MDBListSourceStatus])
def get_mdblist_sources_status(
    current_user: str = Depends(get_current_user)
) -> list[MDBListSourceStatus]:
    # Return sync status for each configured MDBList source.
    try:
        config = load_config()
        sources = list(getattr(getattr(config, "mdblist", None), "sources", []) or [])

        # For now, return basic status without historical sync data
        # Future enhancement: query database for actual sync history
        statuses: list[MDBListSourceStatus] = []
        for idx, source in enumerate(sources):
            statuses.append(
                MDBListSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=None,
                    sync_status="never_synced",
                    error_message=None,
                    items_matched=0,
                    items_total=0,
                )
            )

        return statuses
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mdblist/sources/{index}/sync", response_model=MDBListSyncResponse)
def sync_mdblist_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> MDBListSyncResponse:
    # Manually sync a specific MDBList source to Plex collection.
    try:
        from homescreen_hero.core.integrations.mdblist_sync import sync_single_mdblist_source

        config = load_config()
        sources = list(getattr(getattr(config, "mdblist", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MDBList source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_mdblist_source(server, config, source)
        missing = total - matched

        return MDBListSyncResponse(
            ok=True,
            message=f"Synced '{source.name}' successfully",
            items_total=total,
            items_matched=matched,
            items_missing=missing,
            sync_time=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error syncing MDBList source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/mdblist/sources/{index}/missing", response_model=list[MDBListMissingItemOut])
def get_missing_items_for_mdblist_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> list[MDBListMissingItemOut]:
    # Get items from an MDBList list that weren't found in Plex.
    try:
        from homescreen_hero.core.db import get_session
        from homescreen_hero.core.db.models import MDBListMissingItem

        config = load_config()
        sources = list(getattr(getattr(config, "mdblist", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MDBList source not found")

        source = sources[index]

        # Query database for missing items from this source
        with get_session() as session:
            results = session.query(MDBListMissingItem).filter(
                MDBListMissingItem.source_name == source.name,
                MDBListMissingItem.source_url == source.url
            ).order_by(MDBListMissingItem.last_seen.desc()).all()

            # Convert to response model
            return [
                MDBListMissingItemOut(
                    title=item.title,
                    year=item.year,
                    imdb_id=item.imdb_id,
                    tmdb_id=item.tmdb_id,
                    trakt_id=item.trakt_id,
                    mdblist_id=item.mdblist_id,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    times_seen=item.times_seen,
                )
                for item in results
            ]
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Error fetching missing items for MDBList source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# ANILIST SOURCES
# ========================================================================

@router.get("/anilist/user-lists")
def get_anilist_user_lists(
    username: str,
    current_user: str = Depends(get_current_user),
):
    # Fetch list names for an AniList user (for the dropdown)
    from homescreen_hero.core.integrations.anilist_client import AniListClient, AniListConfig

    if not username.strip():
        raise HTTPException(status_code=400, detail="Username is required")

    client = AniListClient(AniListConfig())
    try:
        lists = client.get_user_lists(username.strip())
        return {"lists": lists}
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/anilist/sources", response_model=list[AniListSource])
def list_anilist_sources(current_user: str = Depends(get_current_user)) -> list[AniListSource]:
    # Return list of all configured AniList sources
    try:
        config = load_config()
        return list(getattr(getattr(config, "anilist", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/anilist/sources", response_model=ConfigSaveResponse)
def create_anilist_source(
    payload: AniListSourcePayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Append new AniList source to config.yaml
    try:
        data = load_config_mapping()
        anilist_section = data.get("anilist") if isinstance(data.get("anilist"), dict) else {}
        anilist_section = dict(anilist_section)

        sources = load_anilist_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        anilist_section["sources"] = sources
        data["anilist"] = anilist_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"AniList source '{payload.name}' added.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/anilist/sources/{index}", response_model=ConfigSaveResponse)
def update_anilist_source(
    index: int,
    payload: AniListSourcePayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    # Replace existing AniList source at given index in config.yaml
    try:
        data = load_config_mapping()
        anilist_section = data.get("anilist") if isinstance(data.get("anilist"), dict) else {}
        anilist_section = dict(anilist_section)

        sources = load_anilist_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="AniList source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        anilist_section["sources"] = sources
        data["anilist"] = anilist_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"AniList source '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/anilist/sources/{index}", response_model=ConfigSaveResponse)
def delete_anilist_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Remove AniList source at given index from config.yaml
    try:
        data = load_config_mapping()
        anilist_section = data.get("anilist") if isinstance(data.get("anilist"), dict) else {}
        anilist_section = dict(anilist_section)

        sources = load_anilist_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="AniList source not found")

        removed = sources.pop(index)
        anilist_section["sources"] = sources
        data["anilist"] = anilist_section

        save_config_mapping(data)

        name = removed.get("name") if isinstance(removed, dict) else None
        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"AniList source '{name or index}' deleted.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/anilist/sources/status", response_model=list[AniListSourceStatus])
def get_anilist_sources_status(
    current_user: str = Depends(get_current_user)
) -> list[AniListSourceStatus]:
    # Return sync status for each configured AniList source.
    try:
        config = load_config()
        sources = list(getattr(getattr(config, "anilist", None), "sources", []) or [])

        statuses: list[AniListSourceStatus] = []
        for idx, source in enumerate(sources):
            statuses.append(
                AniListSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=None,
                    sync_status="never_synced",
                    error_message=None,
                    items_matched=0,
                    items_total=0,
                )
            )

        return statuses
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/anilist/sources/{index}/sync", response_model=AniListSyncResponse)
def sync_anilist_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> AniListSyncResponse:
    # Manually sync a specific AniList source to Plex collection.
    try:
        from homescreen_hero.core.integrations.anilist_sync import sync_single_anilist_source

        config = load_config()
        sources = list(getattr(getattr(config, "anilist", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="AniList source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_anilist_source(server, config, source)
        missing = total - matched

        return AniListSyncResponse(
            ok=True,
            message=f"Synced '{source.name}' successfully",
            items_total=total,
            items_matched=matched,
            items_missing=missing,
            sync_time=datetime.utcnow(),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error syncing AniList source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/anilist/sources/{index}/missing", response_model=list[AniListMissingItemOut])
def get_missing_items_for_anilist_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> list[AniListMissingItemOut]:
    # Get items from an AniList list that weren't found in Plex.
    try:
        from homescreen_hero.core.db import get_session
        from homescreen_hero.core.db.models import AniListMissingItem

        config = load_config()
        sources = list(getattr(getattr(config, "anilist", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="AniList source not found")

        source = sources[index]

        with get_session() as session:
            results = session.query(AniListMissingItem).filter(
                AniListMissingItem.source_name == source.name,
                AniListMissingItem.source_url == source.url
            ).order_by(AniListMissingItem.last_seen.desc()).all()

            return [
                AniListMissingItemOut(
                    title=item.title,
                    year=item.year,
                    media_format=item.media_format,
                    anilist_id=item.anilist_id,
                    mal_id=item.mal_id,
                    tmdb_id=item.tmdb_id,
                    imdb_id=item.imdb_id,
                    tvdb_id=item.tvdb_id,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    times_seen=item.times_seen,
                )
                for item in results
            ]
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Error fetching missing items for AniList source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
