from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import List, Literal, Optional

import yaml

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.config.loader import (
    CONFIG_ENV_VAR,
    get_config_path,
    load_config,
    load_config_text,
    save_config_text,
)
from homescreen_hero.core.config.schema import (
    PlexSettings,
    PlexLibraryConfig,
    RotationSettings,
    TraktSettings,
    TraktSource,
    LetterboxdSettings,
    LetterboxdSource,
    CollectionGroupConfig,
)
from homescreen_hero.core.integrations.plex_client import get_plex_server
from homescreen_hero.core.scheduler import (
    update_rotation_schedule,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/config")


class ConfigFileResponse(BaseModel):
    path: str
    content: str


class ConfigSaveResponse(BaseModel):
    ok: bool
    path: str
    message: str
    env_override: bool


class ConfigUpdateRequest(BaseModel):
    content: str


class GroupValidationResult(BaseModel):
    name: str
    collections: List[str]
    ok: bool
    issues: List[str]


class PlexConfigSaveRequest(PlexSettings):
    """Incoming payload for Plex settings updates."""


class TraktConfigSaveRequest(TraktSettings):
    """Incoming payload for Trakt settings updates."""


class TraktSourcePayload(TraktSource):
    """Incoming payload for Trakt source create/update operations."""


class LetterboxdConfigSaveRequest(LetterboxdSettings):
    """Incoming payload for Letterboxd settings updates."""


class LetterboxdSourcePayload(LetterboxdSource):
    """Incoming payload for Letterboxd source create/update operations."""


class CollectionGroupPayload(CollectionGroupConfig):
    """Group payload used for create/update operations."""


class RotationConfigSaveRequest(RotationSettings):
    """Incoming payload for rotation settings updates."""


class CollectionSourcesResponse(BaseModel):
    class CollectionSource(BaseModel):
        name: str
        source: Literal["plex", "trakt", "letterboxd"]
        detail: Optional[str] = None

    plex: List[CollectionSource]
    trakt: List[CollectionSource]
    letterboxd: List[CollectionSource]


class TraktSourceStatus(BaseModel):
    """Status information for a Trakt source including sync history."""
    source_index: int
    name: str
    last_sync_time: Optional[datetime] = None
    sync_status: Literal["success", "error", "pending", "never_synced"]
    error_message: Optional[str] = None
    items_matched: int = 0
    items_total: int = 0


class TraktSyncResponse(BaseModel):
    """Response from manual Trakt sync operation."""
    ok: bool
    message: str
    items_total: int
    items_matched: int
    items_missing: int
    sync_time: datetime


class TraktMissingItemOut(BaseModel):
    """A Trakt item that wasn't found in Plex."""
    title: str
    year: Optional[int]
    trakt_id: Optional[int]
    slug: Optional[str]
    imdb_id: Optional[str]
    tmdb_id: Optional[int]
    first_seen: datetime
    last_seen: datetime
    times_seen: int


class LetterboxdSourceStatus(BaseModel):
    """Status information for a Letterboxd source including sync history."""
    source_index: int
    name: str
    last_sync_time: Optional[datetime] = None
    sync_status: Literal["success", "error", "pending", "never_synced"]
    error_message: Optional[str] = None
    items_matched: int = 0
    items_total: int = 0


class LetterboxdSyncResponse(BaseModel):
    """Response from manual Letterboxd sync operation."""
    ok: bool
    message: str
    items_total: int
    items_matched: int
    items_missing: int
    sync_time: datetime


class LetterboxdMissingItemOut(BaseModel):
    """A Letterboxd item that wasn't found in Plex."""
    title: str
    year: Optional[int]
    slug: str
    letterboxd_url: Optional[str]
    first_seen: datetime
    last_seen: datetime
    times_seen: int


# Helper to load and save the full config mapping
def _load_config_mapping() -> dict:
    raw_text = load_config_text()
    data = yaml.safe_load(raw_text) or {}
    if not isinstance(data, dict):
        raise ValueError("Config file must contain a YAML mapping at the root")

    return data


# Helper to save the full config mapping
def _save_config_mapping(data: dict) -> None:
    serialized = yaml.safe_dump(data, sort_keys=False)
    save_config_text(serialized)


# Helper to load the list of groups from config mapping
def _load_group_list(data: dict) -> list[dict]:
    groups = data.get("groups") or []
    if not isinstance(groups, list):
        raise ValueError("config.groups must be a list")
    return list(groups)


# Helper to load the list of Trakt sources from config mapping
def _load_trakt_sources(data: dict) -> list[dict]:
    trakt_section = data.get("trakt")
    if trakt_section and not isinstance(trakt_section, dict):
        raise ValueError("config.trakt must be a mapping if present")

    sources = trakt_section.get("sources") if isinstance(trakt_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.trakt.sources must be a list")

    return list(sources or [])


# Helper to load the list of Letterboxd sources from config mapping
def _load_letterboxd_sources(data: dict) -> list[dict]:
    letterboxd_section = data.get("letterboxd")
    if letterboxd_section and not isinstance(letterboxd_section, dict):
        raise ValueError("config.letterboxd must be a mapping if present")

    sources = letterboxd_section.get("sources") if isinstance(letterboxd_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.letterboxd.sources must be a list")

    return list(sources or [])


# Return the current configuration file contents
@router.get("/file", response_model=ConfigFileResponse)
def read_config_file(
    current_user: str = Depends(get_current_user),
) -> ConfigFileResponse:
    try:
        content = load_config_text()
        return ConfigFileResponse(path=str(get_config_path()), content=content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Validate and persist configuration updates provided as YAML text
@router.post("/file", response_model=ConfigSaveResponse)
def save_config(
    payload: ConfigUpdateRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        save_config_text(payload.content)
        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Config saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Return the currently configured Plex settings
@router.get("/plex", response_model=PlexSettings)
def get_plex_settings(current_user: str = Depends(get_current_user)) -> PlexSettings:
    try:
        config = load_config()
        return config.plex
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Update only Plex settings in config.yaml while preserving other keys
@router.post("/plex", response_model=ConfigSaveResponse)
def save_plex_settings(
    payload: PlexConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()

        plex_section = data.get("plex") if isinstance(data.get("plex"), dict) else {}
        plex_section = dict(plex_section)

        plex_section.pop("url", None)  # Remove deprecated key if present
        plex_section.pop("library_name", None)  # Remove deprecated key if present

        # Only save token to config if it's not coming from environment variable
        token_from_env = os.getenv("HSH_PLEX_TOKEN")
        if token_from_env:
            # Don't write token to config if it's set in environment
            plex_section.pop("token", None)
        else:
            # Write token to config only if not using env var
            plex_section["token"] = payload.token

        plex_section.update(
            base_url=payload.base_url,
            libraries=[lib.model_dump(exclude_none=True) for lib in payload.libraries],
        )

        data["plex"] = plex_section
        _save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Plex settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Return the currently configured Trakt settings
@router.get("/trakt", response_model=TraktSettings)
def get_trakt_settings(current_user: str = Depends(get_current_user)) -> TraktSettings:
    try:
        config = load_config()
        return config.trakt
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Update only Trakt settings in config.yaml while preserving other keys
@router.post("/trakt", response_model=ConfigSaveResponse)
def save_trakt_settings(
    payload: TraktConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()

        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(
            trakt_section
        )

        # Only save client_id to config if it's not coming from environment variable
        client_id_from_env = os.getenv("HSH_TRAKT_CLIENT_ID")
        if client_id_from_env:
            # Don't write client_id to config if it's set in environment
            trakt_section.pop("client_id", None)
        else:
            # Write client_id to config only if not using env var
            trakt_section["client_id"] = payload.client_id

        trakt_section.update(
            enabled=payload.enabled,
            base_url=payload.base_url,
        )

        data["trakt"] = trakt_section
        _save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Trakt settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Return list of all configured Trakt sources
@router.get("/trakt/sources", response_model=list[TraktSource])
def list_trakt_sources(current_user: str = Depends(get_current_user),) -> list[TraktSource]:
    try:
        config = load_config()
        return list(getattr(getattr(config, "trakt", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Append new Trakt source to config.yaml
@router.post("/trakt/sources", response_model=ConfigSaveResponse)
def create_trakt_source(
    payload: TraktSourcePayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

        sources = _load_trakt_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        trakt_section["sources"] = sources
        data["trakt"] = trakt_section

        _save_config_mapping(data)

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


# Replace existing Trakt source at given index in config.yaml
@router.put("/trakt/sources/{index}", response_model=ConfigSaveResponse)
def update_trakt_source(
    index: int,
    payload: TraktSourcePayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

        sources = _load_trakt_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        trakt_section["sources"] = sources
        data["trakt"] = trakt_section

        _save_config_mapping(data)

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


# Remove Trakt source at given index from config.yaml
@router.delete("/trakt/sources/{index}", response_model=ConfigSaveResponse)
def delete_trakt_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

        sources = _load_trakt_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        removed = sources.pop(index)
        trakt_section["sources"] = sources
        data["trakt"] = trakt_section

        _save_config_mapping(data)

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


# Get sync status for all Trakt sources
@router.get("/trakt/sources/status", response_model=list[TraktSourceStatus])
def get_trakt_sources_status(
    current_user: str = Depends(get_current_user)
) -> list[TraktSourceStatus]:
    """Return sync status for each configured Trakt source."""
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


# Manually trigger sync for a specific Trakt source
@router.post("/trakt/sources/{index}/sync", response_model=TraktSyncResponse)
def sync_trakt_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> TraktSyncResponse:
    """Manually sync a specific Trakt source to Plex collection."""
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


# Get missing items for a specific Trakt source
@router.get("/trakt/sources/{index}/missing", response_model=list[TraktMissingItemOut])
def get_missing_items_for_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> list[TraktMissingItemOut]:
    """Get items from a Trakt list that weren't found in Plex."""
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


# Return the currently configured Letterboxd settings
@router.get("/letterboxd", response_model=LetterboxdSettings)
def get_letterboxd_settings(current_user: str = Depends(get_current_user)) -> LetterboxdSettings:
    try:
        config = load_config()
        return config.letterboxd if config.letterboxd else LetterboxdSettings(enabled=False, sources=[])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Update only Letterboxd settings in config.yaml while preserving other keys
@router.post("/letterboxd", response_model=ConfigSaveResponse)
def save_letterboxd_settings(
    payload: LetterboxdConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()

        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        letterboxd_section.update(
            enabled=payload.enabled,
        )

        data["letterboxd"] = letterboxd_section
        _save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Letterboxd settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Return list of all configured Letterboxd sources
@router.get("/letterboxd/sources", response_model=list[LetterboxdSource])
def list_letterboxd_sources(current_user: str = Depends(get_current_user),) -> list[LetterboxdSource]:
    try:
        config = load_config()
        return list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Append new Letterboxd source to config.yaml
@router.post("/letterboxd/sources", response_model=ConfigSaveResponse)
def create_letterboxd_source(
    payload: LetterboxdSourcePayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        sources = _load_letterboxd_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        letterboxd_section["sources"] = sources
        data["letterboxd"] = letterboxd_section

        _save_config_mapping(data)

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


# Replace existing Letterboxd source at given index in config.yaml
@router.put("/letterboxd/sources/{index}", response_model=ConfigSaveResponse)
def update_letterboxd_source(
    index: int,
    payload: LetterboxdSourcePayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        sources = _load_letterboxd_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        letterboxd_section["sources"] = sources
        data["letterboxd"] = letterboxd_section

        _save_config_mapping(data)

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


# Remove Letterboxd source at given index from config.yaml
@router.delete("/letterboxd/sources/{index}", response_model=ConfigSaveResponse)
def delete_letterboxd_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        sources = _load_letterboxd_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        removed = sources.pop(index)
        letterboxd_section["sources"] = sources
        data["letterboxd"] = letterboxd_section

        _save_config_mapping(data)

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


# Get sync status for all Letterboxd sources
@router.get("/letterboxd/sources/status", response_model=list[LetterboxdSourceStatus])
def get_letterboxd_sources_status(
    current_user: str = Depends(get_current_user)
) -> list[LetterboxdSourceStatus]:
    """Return sync status for each configured Letterboxd source."""
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


# Manually trigger sync for a specific Letterboxd source
@router.post("/letterboxd/sources/{index}/sync", response_model=LetterboxdSyncResponse)
def sync_letterboxd_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> LetterboxdSyncResponse:
    """Manually sync a specific Letterboxd source to Plex collection."""
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


# Get missing items for a specific Letterboxd source
@router.get("/letterboxd/sources/{index}/missing", response_model=list[LetterboxdMissingItemOut])
def get_missing_items_for_letterboxd_source(
    index: int,
    current_user: str = Depends(get_current_user)
) -> list[LetterboxdMissingItemOut]:
    """Get items from a Letterboxd list that weren't found in Plex."""
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


# Validate configured collection groups against Plex collections
@router.get("/validate", response_model=List[GroupValidationResult])
def validate_config_groups(current_user: str = Depends(get_current_user)) -> List[GroupValidationResult]:
    config = load_config()
    server = get_plex_server(config)

    # Build a map of all Plex collections by name for cheap lookup
    all_collections_by_name: dict[str, bool] = {}
    for section in server.library.sections():
        try:
            for col in section.collections():
                all_collections_by_name[col.title] = True
        except Exception:
            continue

    results: list[GroupValidationResult] = []
    for group in getattr(config, "groups", []):
        group_name = getattr(group, "name", "Unnamed")
        collections = list(getattr(group, "collections", []))

        issues: list[str] = []
        duplicates: list[str] = []

        seen = set()
        for collection in collections:
            if collection in seen and collection not in duplicates:
                duplicates.append(collection)
            seen.add(collection)

        if duplicates:
            issues.append(f"Duplicate collections in group: {', '.join(duplicates)}")

        missing = [c for c in collections if c not in all_collections_by_name]
        if missing:
            issues.append(f"Missing in Plex: {', '.join(missing)}")

        results.append(
            GroupValidationResult(
                name=group_name,
                collections=collections,
                ok=not issues,
                issues=issues,
            )
        )

    return results


# Return list of all configured collection groups
@router.get("/groups", response_model=list[CollectionGroupConfig])
def list_groups(current_user: str = Depends(get_current_user)) -> list[CollectionGroupConfig]:
    try:
        config = load_config()
        return config.groups
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Append new collection group to config.yaml
@router.post("/groups", response_model=ConfigSaveResponse)
def create_group(
    payload: CollectionGroupPayload,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        groups = _load_group_list(data)

        groups.append(payload.model_dump(exclude_none=True))
        config_path = get_config_path()
        _save_config_mapping({**data, "groups": groups})

        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Group '{payload.name}' added.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Replace existing collection group at given index in config.yaml
@router.put("/groups/{index}", response_model=ConfigSaveResponse)
def update_group(
    index: int,
    payload: CollectionGroupPayload,
    current_user: str = Depends(get_current_user),
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        groups = _load_group_list(data)

        if index < 0 or index >= len(groups):
            raise HTTPException(status_code=404, detail="Group not found")

        groups[index] = payload.model_dump(exclude_none=True)
        config_path = get_config_path()
        _save_config_mapping({**data, "groups": groups})

        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Group '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Remove collection group at given index from config.yaml
@router.delete("/groups/{index}", response_model=ConfigSaveResponse)
def delete_group(
    index: int,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()
        groups = _load_group_list(data)

        if index < 0 or index >= len(groups):
            raise HTTPException(status_code=404, detail="Group not found")

        removed = groups.pop(index)
        config_path = get_config_path()
        _save_config_mapping({**data, "groups": groups})

        name = removed.get("name") if isinstance(removed, dict) else None
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Group '{name or index}' deleted.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Return list of all available Plex collections and configured Trakt/Letterboxd sources
@router.get("/group-sources", response_model=CollectionSourcesResponse)
def list_group_sources(current_user: str = Depends(get_current_user)) -> CollectionSourcesResponse:
    try:
        config = load_config()
        server = get_plex_server(config)

        plex_sources: list[CollectionSourcesResponse.CollectionSource] = []
        for section in server.library.sections():
            try:
                for col in section.collections():
                    plex_sources.append(
                        CollectionSourcesResponse.CollectionSource(
                            name=col.title,
                            source="plex",
                            detail=section.title,
                        )
                    )
            except Exception:  # pragma: no cover - defensive
                continue

        trakt_sources: list[CollectionSourcesResponse.CollectionSource] = []
        trakt_cfg: Optional[TraktSettings] = getattr(config, "trakt", None)
        if trakt_cfg and getattr(trakt_cfg, "sources", None):
            for src in trakt_cfg.sources:
                trakt_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="trakt",
                        detail=src.plex_library or src.url,
                    )
                )

        letterboxd_sources: list[CollectionSourcesResponse.CollectionSource] = []
        letterboxd_cfg: Optional[LetterboxdSettings] = getattr(config, "letterboxd", None)
        if letterboxd_cfg and getattr(letterboxd_cfg, "sources", None):
            for src in letterboxd_cfg.sources:
                letterboxd_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="letterboxd",
                        detail=src.plex_library or src.url,
                    )
                )

        return CollectionSourcesResponse(plex=plex_sources, trakt=trakt_sources, letterboxd=letterboxd_sources)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Return all rotation scheduler configuration settings
@router.get("/rotation", response_model=RotationSettings)
def get_rotation_settings(current_user: str = Depends(get_current_user)) -> RotationSettings:
    try:
        config = load_config()
        return config.rotation
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Update only global rotation settings while preserving other config keys
@router.post("/rotation", response_model=ConfigSaveResponse)
def save_rotation_settings(
    payload: RotationConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    try:
        data = _load_config_mapping()

        rotation_section = (
            data.get("rotation") if isinstance(data.get("rotation"), dict) else {}
        )
        rotation_section = dict(rotation_section)

        rotation_section.update(
            enabled=payload.enabled,
            interval_hours=payload.interval_hours,
            max_collections=payload.max_collections,
            strategy=payload.strategy,
            allow_repeats=payload.allow_repeats,
        )

        data["rotation"] = rotation_section
        _save_config_mapping(data)

        updated_config = load_config()
        update_rotation_schedule(config=updated_config)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Rotation settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Quick start setup endpoints
class ConfigExistsResponse(BaseModel):
    exists: bool
    is_configured: bool
    path: str


class EnvVarsResponse(BaseModel):
    plex_token_from_env: bool
    plex_url_from_env: bool
    auth_password_from_env: bool
    auth_secret_from_env: bool
    trakt_client_id_from_env: bool


class QuickStartRequest(BaseModel):
    plex_url: str
    plex_token: str
    trakt_enabled: bool = False
    trakt_client_id: Optional[str] = None
    trakt_base_url: str = "https://api.trakt.tv"
    libraries: List[str] = []
    auth_enabled: bool = False
    auth_username: Optional[str] = None
    auth_password: Optional[str] = None
    rotation_enabled: bool = False
    rotation_interval_hours: int = 12
    rotation_max_collections: int = 5
    rotation_strategy: str = "random"
    rotation_allow_repeats: bool = False


@router.get("/exists", response_model=ConfigExistsResponse)
def check_config_exists() -> ConfigExistsResponse:
    """Check if config file exists and is minimally configured."""
    try:
        config_path = get_config_path()
        exists = config_path.exists()

        is_configured = False
        if exists:
            try:
                config = load_config()
                # Consider it configured if it has a Plex URL
                is_configured = bool(config.plex.base_url)
            except Exception:
                # Config exists but is invalid
                is_configured = False

        return ConfigExistsResponse(
            exists=exists,
            is_configured=is_configured,
            path=str(config_path)
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/env-vars", response_model=EnvVarsResponse)
def check_env_vars() -> EnvVarsResponse:
    """Check which configuration values are provided via environment variables."""
    return EnvVarsResponse(
        plex_token_from_env=bool(os.getenv("HSH_PLEX_TOKEN")),
        plex_url_from_env=bool(os.getenv("HSH_PLEX_URL")),
        auth_password_from_env=bool(os.getenv("HSH_AUTH_PASSWORD")),
        auth_secret_from_env=bool(os.getenv("HSH_AUTH_SECRET_KEY")),
        trakt_client_id_from_env=bool(os.getenv("HSH_TRAKT_CLIENT_ID")),
    )


@router.post("/quick-start", response_model=ConfigSaveResponse)
def quick_start_setup(payload: QuickStartRequest) -> ConfigSaveResponse:
    """Initialize config.yaml with minimal Plex and optional Trakt settings."""
    try:
        # SECURITY: Only allow quick-start if auth is not configured
        # This prevents unauthorized overwrites while allowing the wizard to work
        config_status = check_config_exists()
        if config_status.is_configured:
            try:
                config = load_config()
                # If auth is enabled and configured, reject the request
                if config.auth.enabled and config.auth.password:
                    raise HTTPException(
                        status_code=403,
                        detail="Configuration is protected. Use the settings page to modify configuration."
                    )
            except Exception:
                # If we can't load config, allow the setup to proceed
                pass

        config_path = get_config_path()

        # Use environment variables if payload values are empty
        plex_url = payload.plex_url or os.getenv("HSH_PLEX_URL", "")
        plex_token = payload.plex_token or os.getenv("HSH_PLEX_TOKEN", "")
        plex_token_from_env = os.getenv("HSH_PLEX_TOKEN")

        # Build minimal config structure
        # Convert library names to library config objects
        libraries_config = [{"name": lib, "enabled": True} for lib in payload.libraries]

        minimal_config = {
            "plex": {
                "base_url": plex_url,
                "libraries": libraries_config
            },
            "rotation": {
                "enabled": payload.rotation_enabled,
                "interval_hours": payload.rotation_interval_hours,
                "max_collections": payload.rotation_max_collections,
                "strategy": payload.rotation_strategy,
                "allow_repeats": payload.rotation_allow_repeats
            },
            "logging": {
                "level": "INFO"
            },
            "groups": []
        }

        # Only write plex token to config if not from environment variable
        if not plex_token_from_env:
            minimal_config["plex"]["token"] = plex_token

        # Add Trakt if enabled
        # Use environment variable if payload value is empty
        trakt_client_id = payload.trakt_client_id or os.getenv("HSH_TRAKT_CLIENT_ID", "")
        trakt_client_id_from_env = os.getenv("HSH_TRAKT_CLIENT_ID")

        if payload.trakt_enabled and trakt_client_id:
            minimal_config["trakt"] = {
                "enabled": True,
                "base_url": payload.trakt_base_url,
                "sources": []
            }
            # Only write client_id to config if not from environment variable
            if not trakt_client_id_from_env:
                minimal_config["trakt"]["client_id"] = trakt_client_id
        else:
            minimal_config["trakt"] = {
                "enabled": False,
                "base_url": payload.trakt_base_url,
                "sources": []
            }

        # Add auth configuration
        # Check if password is provided via env var or payload
        password_from_env = os.getenv("HSH_AUTH_PASSWORD")
        auth_password = payload.auth_password or password_from_env

        if payload.auth_enabled and payload.auth_username and auth_password:
            secret_from_env = os.getenv("HSH_AUTH_SECRET_KEY")

            minimal_config["auth"] = {
                "enabled": True,
                "username": payload.auth_username,
                "token_expire_days": 30
            }

            # Only write to config if not using env vars
            if not password_from_env:
                minimal_config["auth"]["password"] = payload.auth_password
            if not secret_from_env:
                # Generate a random secret key
                import secrets
                minimal_config["auth"]["secret_key"] = secrets.token_urlsafe(32)
        else:
            minimal_config["auth"] = {
                "enabled": False,
                "username": "admin",
                "token_expire_days": 30
            }

        # Serialize and save
        serialized = yaml.safe_dump(minimal_config, sort_keys=False)
        save_config_text(serialized)

        # Update rotation scheduler if rotation is enabled
        if payload.rotation_enabled:
            updated_config = load_config()
            update_rotation_schedule(config=updated_config)

        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Configuration initialized successfully. You can now configure libraries and rotation groups."
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
