from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query

from homescreen_hero.core.auth import CurrentUser, get_current_user, require_admin
from homescreen_hero.core.config.loader import (
    CONFIG_ENV_VAR,
    get_config_path,
    load_config,
)
from homescreen_hero.core.config.schema import (
    TraktSource,
    LetterboxdSource,
    MDBListSource,
    TMDbSource,
    AniListSource,
    MALSource,
)
from homescreen_hero.core.integrations.plex_client import get_plex_server

from .helpers import (
    load_config_mapping,
    save_config_mapping,
    load_trakt_sources,
    load_letterboxd_sources,
    load_mdblist_sources,
    load_tmdb_sources,
    load_anilist_sources,
    load_mal_sources,
    get_all_source_names,
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
    TMDbSourcePayload,
    TMDbSourceStatus,
    TMDbSyncResponse,
    TMDbMissingItemOut,
    AniListSourcePayload,
    AniListSourceStatus,
    AniListSyncResponse,
    AniListMissingItemOut,
    MALSourcePayload,
    MALSourceStatus,
    MALSyncResponse,
    MALMissingItemOut,
)

import os

logger = logging.getLogger(__name__)

router = APIRouter()


def _delete_plex_collection(source_name: str, plex_library: str) -> None:
    # Delete a Plex collection by name from the specified library.
    # Only called when the user explicitly opts in via delete_collection=true.
    try:
        config = load_config()
        server = get_plex_server(config)
        library = server.library.section(plex_library)
        collection = library.collection(source_name)
        collection.delete()
        logger.info("Deleted Plex collection '%s' from library '%s'", source_name, plex_library)
    except Exception as exc:
        logger.warning(
            "Could not delete Plex collection '%s' from '%s': %s",
            source_name, plex_library, exc,
        )


# ========================================================================
# TRAKT SOURCES
# ========================================================================

@router.get("/trakt/sources", response_model=list[TraktSource])
def list_trakt_sources(current_user: CurrentUser = Depends(require_admin)) -> list[TraktSource]:
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
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new Trakt source to config.yaml
    try:
        data = load_config_mapping()

        if payload.name in get_all_source_names(data):
            raise HTTPException(status_code=409, detail=f"A source named '{payload.name}' already exists. Please choose a different name.")

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
    except HTTPException:
        raise
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
    current_user: CurrentUser = Depends(require_admin),
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
    delete_collection: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
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
        plex_library = removed.get("plex_library") if isinstance(removed, dict) else None
        if delete_collection and name and plex_library:
            _delete_plex_collection(name, plex_library)

        config_path = get_config_path()
        msg = f"Trakt source '{name or index}' deleted."
        if delete_collection and name:
            msg += f" Plex collection '{name}' also removed."
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=msg,
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
    current_user: CurrentUser = Depends(require_admin)
) -> list[TraktSourceStatus]:
    # Return sync status for each configured Trakt source.
    try:
        from homescreen_hero.core.db import get_sync_status

        config = load_config()
        sources = list(getattr(getattr(config, "trakt", None), "sources", []) or [])

        statuses: list[TraktSourceStatus] = []
        for idx, source in enumerate(sources):
            record = get_sync_status("trakt", source.name)
            statuses.append(
                TraktSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=record.last_sync_time if record else None,
                    sync_status=record.sync_status if record else "never_synced",
                    error_message=record.error_message if record else None,
                    items_matched=record.items_matched if record else 0,
                    items_total=record.items_total if record else 0,
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
    current_user: CurrentUser = Depends(require_admin)
) -> TraktSyncResponse:
    # Manually sync a specific Trakt source to Plex collection.
    try:
        from homescreen_hero.core.integrations.trakt_sync import sync_single_trakt_source
        from homescreen_hero.core.db import record_sync_result

        config = load_config()
        sources = list(getattr(getattr(config, "trakt", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Trakt source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_trakt_source(server, config, source)
        missing = total - matched

        record_sync_result(
            integration_type="trakt",
            source_name=source.name,
            source_url=source.url,
            items_total=total,
            items_matched=matched,
        )

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

        # Record the failure
        try:
            from homescreen_hero.core.db import record_sync_result
            config = load_config()
            sources = list(getattr(getattr(config, "trakt", None), "sources", []) or [])
            if 0 <= index < len(sources):
                record_sync_result(
                    integration_type="trakt",
                    source_name=sources[index].name,
                    source_url=sources[index].url,
                    items_total=0,
                    items_matched=0,
                    sync_status="error",
                    error_message=str(exc),
                )
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/trakt/sources/{index}/missing", response_model=list[TraktMissingItemOut])
def get_missing_items_for_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
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
def list_letterboxd_sources(current_user: CurrentUser = Depends(require_admin)) -> list[LetterboxdSource]:
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
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new Letterboxd source to config.yaml
    try:
        data = load_config_mapping()

        if payload.name in get_all_source_names(data):
            raise HTTPException(status_code=409, detail=f"A source named '{payload.name}' already exists. Please choose a different name.")

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
    except HTTPException:
        raise
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
    current_user: CurrentUser = Depends(require_admin),
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
    delete_collection: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
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
        plex_library = removed.get("plex_library") if isinstance(removed, dict) else None
        if delete_collection and name and plex_library:
            _delete_plex_collection(name, plex_library)

        config_path = get_config_path()
        msg = f"Letterboxd source '{name or index}' deleted."
        if delete_collection and name:
            msg += f" Plex collection '{name}' also removed."
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=msg,
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
    current_user: CurrentUser = Depends(require_admin)
) -> list[LetterboxdSourceStatus]:
    # Return sync status for each configured Letterboxd source.
    try:
        from homescreen_hero.core.db import get_sync_status

        config = load_config()
        sources = list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])

        statuses: list[LetterboxdSourceStatus] = []
        for idx, source in enumerate(sources):
            record = get_sync_status("letterboxd", source.name)
            statuses.append(
                LetterboxdSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=record.last_sync_time if record else None,
                    sync_status=record.sync_status if record else "never_synced",
                    error_message=record.error_message if record else None,
                    items_matched=record.items_matched if record else 0,
                    items_total=record.items_total if record else 0,
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
    current_user: CurrentUser = Depends(require_admin)
) -> LetterboxdSyncResponse:
    # Manually sync a specific Letterboxd source to Plex collection.
    try:
        from homescreen_hero.core.integrations.letterboxd_sync import sync_single_letterboxd_source
        from homescreen_hero.core.db import record_sync_result

        config = load_config()
        sources = list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="Letterboxd source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_letterboxd_source(server, config, source)
        missing = total - matched

        record_sync_result(
            integration_type="letterboxd",
            source_name=source.name,
            source_url=source.url,
            items_total=total,
            items_matched=matched,
        )

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

        try:
            from homescreen_hero.core.db import record_sync_result
            config = load_config()
            sources = list(getattr(getattr(config, "letterboxd", None), "sources", []) or [])
            if 0 <= index < len(sources):
                record_sync_result(
                    integration_type="letterboxd",
                    source_name=sources[index].name,
                    source_url=sources[index].url,
                    items_total=0,
                    items_matched=0,
                    sync_status="error",
                    error_message=str(exc),
                )
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/letterboxd/sources/{index}/missing", response_model=list[LetterboxdMissingItemOut])
def get_missing_items_for_letterboxd_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
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
def list_mdblist_sources(current_user: CurrentUser = Depends(require_admin)) -> list[MDBListSource]:
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
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new MDBList source to config.yaml
    try:
        data = load_config_mapping()

        if payload.name in get_all_source_names(data):
            raise HTTPException(status_code=409, detail=f"A source named '{payload.name}' already exists. Please choose a different name.")

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
    except HTTPException:
        raise
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
    current_user: CurrentUser = Depends(require_admin),
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
    delete_collection: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
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
        plex_library = removed.get("plex_library") if isinstance(removed, dict) else None
        if delete_collection and name and plex_library:
            _delete_plex_collection(name, plex_library)

        config_path = get_config_path()
        msg = f"MDBList source '{name or index}' deleted."
        if delete_collection and name:
            msg += f" Plex collection '{name}' also removed."
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=msg,
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
    current_user: CurrentUser = Depends(require_admin)
) -> list[MDBListSourceStatus]:
    # Return sync status for each configured MDBList source.
    try:
        from homescreen_hero.core.db import get_sync_status

        config = load_config()
        sources = list(getattr(getattr(config, "mdblist", None), "sources", []) or [])

        statuses: list[MDBListSourceStatus] = []
        for idx, source in enumerate(sources):
            record = get_sync_status("mdblist", source.name)
            statuses.append(
                MDBListSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=record.last_sync_time if record else None,
                    sync_status=record.sync_status if record else "never_synced",
                    error_message=record.error_message if record else None,
                    items_matched=record.items_matched if record else 0,
                    items_total=record.items_total if record else 0,
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
    current_user: CurrentUser = Depends(require_admin)
) -> MDBListSyncResponse:
    # Manually sync a specific MDBList source to Plex collection.
    try:
        from homescreen_hero.core.integrations.mdblist_sync import sync_single_mdblist_source
        from homescreen_hero.core.db import record_sync_result

        config = load_config()
        sources = list(getattr(getattr(config, "mdblist", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MDBList source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_mdblist_source(server, config, source)
        missing = total - matched

        record_sync_result(
            integration_type="mdblist",
            source_name=source.name,
            source_url=source.url,
            items_total=total,
            items_matched=matched,
        )

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

        try:
            from homescreen_hero.core.db import record_sync_result
            config = load_config()
            sources = list(getattr(getattr(config, "mdblist", None), "sources", []) or [])
            if 0 <= index < len(sources):
                record_sync_result(
                    integration_type="mdblist",
                    source_name=sources[index].name,
                    source_url=sources[index].url,
                    items_total=0,
                    items_matched=0,
                    sync_status="error",
                    error_message=str(exc),
                )
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/mdblist/sources/{index}/missing", response_model=list[MDBListMissingItemOut])
def get_missing_items_for_mdblist_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
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
# TMDB SOURCES
# ========================================================================

@router.get("/tmdb/sources", response_model=list[TMDbSource])
def list_tmdb_sources(current_user: CurrentUser = Depends(require_admin)) -> list[TMDbSource]:
    # Return list of all configured TMDb sources
    try:
        config = load_config()
        return list(getattr(getattr(config, "tmdb", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/tmdb/sources", response_model=ConfigSaveResponse)
def create_tmdb_source(
    payload: TMDbSourcePayload,
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new TMDb source to config.yaml
    try:
        data = load_config_mapping()

        if payload.name in get_all_source_names(data):
            raise HTTPException(status_code=409, detail=f"A source named '{payload.name}' already exists. Please choose a different name.")

        tmdb_section = data.get("tmdb") if isinstance(data.get("tmdb"), dict) else {}
        tmdb_section = dict(tmdb_section)

        sources = load_tmdb_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        tmdb_section["sources"] = sources
        data["tmdb"] = tmdb_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"TMDb source '{payload.name}' added.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/tmdb/sources/{index}", response_model=ConfigSaveResponse)
def update_tmdb_source(
    index: int,
    payload: TMDbSourcePayload,
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Replace existing TMDb source at given index in config.yaml
    try:
        data = load_config_mapping()
        tmdb_section = data.get("tmdb") if isinstance(data.get("tmdb"), dict) else {}
        tmdb_section = dict(tmdb_section)

        sources = load_tmdb_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="TMDb source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        tmdb_section["sources"] = sources
        data["tmdb"] = tmdb_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"TMDb source '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/tmdb/sources/{index}", response_model=ConfigSaveResponse)
def delete_tmdb_source(
    index: int,
    delete_collection: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Remove TMDb source at given index from config.yaml
    try:
        data = load_config_mapping()
        tmdb_section = data.get("tmdb") if isinstance(data.get("tmdb"), dict) else {}
        tmdb_section = dict(tmdb_section)

        sources = load_tmdb_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="TMDb source not found")

        removed = sources.pop(index)
        tmdb_section["sources"] = sources
        data["tmdb"] = tmdb_section

        save_config_mapping(data)

        name = removed.get("name") if isinstance(removed, dict) else None
        plex_library = removed.get("plex_library") if isinstance(removed, dict) else None
        if delete_collection and name and plex_library:
            _delete_plex_collection(name, plex_library)

        config_path = get_config_path()
        msg = f"TMDb source '{name or index}' deleted."
        if delete_collection and name:
            msg += f" Plex collection '{name}' also removed."
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=msg,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/tmdb/sources/status", response_model=list[TMDbSourceStatus])
def get_tmdb_sources_status(
    current_user: CurrentUser = Depends(require_admin)
) -> list[TMDbSourceStatus]:
    # Return sync status for each configured TMDb source.
    try:
        from homescreen_hero.core.db import get_sync_status

        config = load_config()
        sources = list(getattr(getattr(config, "tmdb", None), "sources", []) or [])

        statuses: list[TMDbSourceStatus] = []
        for idx, source in enumerate(sources):
            record = get_sync_status("tmdb", source.name)
            statuses.append(
                TMDbSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=record.last_sync_time if record else None,
                    sync_status=record.sync_status if record else "never_synced",
                    error_message=record.error_message if record else None,
                    items_matched=record.items_matched if record else 0,
                    items_total=record.items_total if record else 0,
                )
            )

        return statuses
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/tmdb/sources/{index}/sync", response_model=TMDbSyncResponse)
def sync_tmdb_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
) -> TMDbSyncResponse:
    # Manually sync a specific TMDb source to Plex collection.
    try:
        from homescreen_hero.core.integrations.tmdb_sync import sync_single_tmdb_source
        from homescreen_hero.core.db import record_sync_result

        config = load_config()
        sources = list(getattr(getattr(config, "tmdb", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="TMDb source not found")

        source = sources[index]
        server = get_plex_server(config)

        total, matched = sync_single_tmdb_source(server, config, source)
        missing = total - matched

        record_sync_result(
            integration_type="tmdb",
            source_name=source.name,
            source_url=source.url,
            items_total=total,
            items_matched=matched,
        )

        return TMDbSyncResponse(
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
        logger.error("Error syncing TMDb source at index %d: %s", index, exc)

        try:
            from homescreen_hero.core.db import record_sync_result
            config = load_config()
            sources = list(getattr(getattr(config, "tmdb", None), "sources", []) or [])
            if 0 <= index < len(sources):
                record_sync_result(
                    integration_type="tmdb",
                    source_name=sources[index].name,
                    source_url=sources[index].url,
                    items_total=0,
                    items_matched=0,
                    sync_status="error",
                    error_message=str(exc),
                )
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/tmdb/sources/{index}/missing", response_model=list[TMDbMissingItemOut])
def get_missing_items_for_tmdb_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
) -> list[TMDbMissingItemOut]:
    # Get items from a TMDb list that weren't found in Plex.
    try:
        from homescreen_hero.core.db import get_session
        from homescreen_hero.core.db.models import TMDbMissingItem

        config = load_config()
        sources = list(getattr(getattr(config, "tmdb", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="TMDb source not found")

        source = sources[index]

        with get_session() as session:
            results = session.query(TMDbMissingItem).filter(
                TMDbMissingItem.source_name == source.name,
                TMDbMissingItem.source_url == source.url
            ).order_by(TMDbMissingItem.last_seen.desc()).all()

            return [
                TMDbMissingItemOut(
                    title=item.title,
                    year=item.year,
                    tmdb_id=item.tmdb_id,
                    media_type=item.media_type,
                    first_seen=item.first_seen,
                    last_seen=item.last_seen,
                    times_seen=item.times_seen,
                )
                for item in results
            ]
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Error fetching missing items for TMDb source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# ANILIST SOURCES
# ========================================================================

@router.get("/anilist/user-lists")
def get_anilist_user_lists(
    username: str,
    current_user: CurrentUser = Depends(require_admin),
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
def list_anilist_sources(current_user: CurrentUser = Depends(require_admin)) -> list[AniListSource]:
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
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new AniList source to config.yaml
    try:
        data = load_config_mapping()

        if payload.name in get_all_source_names(data):
            raise HTTPException(status_code=409, detail=f"A source named '{payload.name}' already exists. Please choose a different name.")

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
    except HTTPException:
        raise
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
    current_user: CurrentUser = Depends(require_admin),
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
    delete_collection: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
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
        plex_library = removed.get("plex_library") if isinstance(removed, dict) else None
        if delete_collection and name and plex_library:
            _delete_plex_collection(name, plex_library)

        config_path = get_config_path()
        msg = f"AniList source '{name or index}' deleted."
        if delete_collection and name:
            msg += f" Plex collection '{name}' also removed."
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=msg,
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
    current_user: CurrentUser = Depends(require_admin)
) -> list[AniListSourceStatus]:
    # Return sync status for each configured AniList source.
    try:
        from homescreen_hero.core.db import get_sync_status

        config = load_config()
        sources = list(getattr(getattr(config, "anilist", None), "sources", []) or [])

        statuses: list[AniListSourceStatus] = []
        for idx, source in enumerate(sources):
            record = get_sync_status("anilist", source.name)
            statuses.append(
                AniListSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=record.last_sync_time if record else None,
                    sync_status=record.sync_status if record else "never_synced",
                    error_message=record.error_message if record else None,
                    items_matched=record.items_matched if record else 0,
                    items_total=record.items_total if record else 0,
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
    current_user: CurrentUser = Depends(require_admin)
) -> AniListSyncResponse:
    # Manually sync a specific AniList source to Plex collection.
    try:
        from homescreen_hero.core.integrations.anilist_sync import sync_single_anilist_source
        from homescreen_hero.core.db import record_sync_result

        config = load_config()
        sources = list(getattr(getattr(config, "anilist", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="AniList source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_anilist_source(server, config, source)
        missing = total - matched

        record_sync_result(
            integration_type="anilist",
            source_name=source.name,
            source_url=source.url,
            items_total=total,
            items_matched=matched,
        )

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

        try:
            from homescreen_hero.core.db import record_sync_result
            config = load_config()
            sources = list(getattr(getattr(config, "anilist", None), "sources", []) or [])
            if 0 <= index < len(sources):
                record_sync_result(
                    integration_type="anilist",
                    source_name=sources[index].name,
                    source_url=sources[index].url,
                    items_total=0,
                    items_matched=0,
                    sync_status="error",
                    error_message=str(exc),
                )
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/anilist/sources/{index}/missing", response_model=list[AniListMissingItemOut])
def get_missing_items_for_anilist_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
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


# ========================================================================
# MAL SOURCES
# ========================================================================

@router.get("/mal/sources", response_model=list[MALSource])
def list_mal_sources(current_user: CurrentUser = Depends(require_admin)) -> list[MALSource]:
    # Return list of all configured MAL sources
    try:
        config = load_config()
        return list(getattr(getattr(config, "mal", None), "sources", []) or [])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mal/sources", response_model=ConfigSaveResponse)
def create_mal_source(
    payload: MALSourcePayload,
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new MAL source to config.yaml
    try:
        data = load_config_mapping()

        if payload.name in get_all_source_names(data):
            raise HTTPException(status_code=409, detail=f"A source named '{payload.name}' already exists. Please choose a different name.")

        mal_section = data.get("mal") if isinstance(data.get("mal"), dict) else {}
        mal_section = dict(mal_section)

        sources = load_mal_sources(data)
        sources.append(payload.model_dump(exclude_none=True))

        mal_section["sources"] = sources
        data["mal"] = mal_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"MAL source '{payload.name}' added.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/mal/sources/{index}", response_model=ConfigSaveResponse)
def update_mal_source(
    index: int,
    payload: MALSourcePayload,
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Replace existing MAL source at given index in config.yaml
    try:
        data = load_config_mapping()
        mal_section = data.get("mal") if isinstance(data.get("mal"), dict) else {}
        mal_section = dict(mal_section)

        sources = load_mal_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MAL source not found")

        sources[index] = payload.model_dump(exclude_none=True)
        mal_section["sources"] = sources
        data["mal"] = mal_section

        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"MAL source '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/mal/sources/{index}", response_model=ConfigSaveResponse)
def delete_mal_source(
    index: int,
    delete_collection: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Remove MAL source at given index from config.yaml
    try:
        data = load_config_mapping()
        mal_section = data.get("mal") if isinstance(data.get("mal"), dict) else {}
        mal_section = dict(mal_section)

        sources = load_mal_sources(data)
        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MAL source not found")

        removed = sources.pop(index)
        mal_section["sources"] = sources
        data["mal"] = mal_section

        save_config_mapping(data)

        name = removed.get("name") if isinstance(removed, dict) else None
        plex_library = removed.get("plex_library") if isinstance(removed, dict) else None
        if delete_collection and name and plex_library:
            _delete_plex_collection(name, plex_library)

        config_path = get_config_path()
        msg = f"MAL source '{name or index}' deleted."
        if delete_collection and name:
            msg += f" Plex collection '{name}' also removed."
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=msg,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/mal/sources/status", response_model=list[MALSourceStatus])
def get_mal_sources_status(
    current_user: CurrentUser = Depends(require_admin)
) -> list[MALSourceStatus]:
    # Return sync status for each configured MAL source.
    try:
        from homescreen_hero.core.db import get_sync_status

        config = load_config()
        sources = list(getattr(getattr(config, "mal", None), "sources", []) or [])

        statuses: list[MALSourceStatus] = []
        for idx, source in enumerate(sources):
            record = get_sync_status("mal", source.name)
            statuses.append(
                MALSourceStatus(
                    source_index=idx,
                    name=source.name,
                    last_sync_time=record.last_sync_time if record else None,
                    sync_status=record.sync_status if record else "never_synced",
                    error_message=record.error_message if record else None,
                    items_matched=record.items_matched if record else 0,
                    items_total=record.items_total if record else 0,
                )
            )

        return statuses
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mal/sources/{index}/sync", response_model=MALSyncResponse)
def sync_mal_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
) -> MALSyncResponse:
    # Manually sync a specific MAL source to Plex collection.
    try:
        from homescreen_hero.core.integrations.mal_sync import sync_single_mal_source
        from homescreen_hero.core.db import record_sync_result

        config = load_config()
        sources = list(getattr(getattr(config, "mal", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MAL source not found")

        source = sources[index]
        server = get_plex_server(config)

        # Execute the sync
        total, matched = sync_single_mal_source(server, config, source)
        missing = total - matched

        record_sync_result(
            integration_type="mal",
            source_name=source.name,
            source_url=source.url,
            items_total=total,
            items_matched=matched,
        )

        return MALSyncResponse(
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
        logger.error("Error syncing MAL source at index %d: %s", index, exc)

        try:
            from homescreen_hero.core.db import record_sync_result
            config = load_config()
            sources = list(getattr(getattr(config, "mal", None), "sources", []) or [])
            if 0 <= index < len(sources):
                record_sync_result(
                    integration_type="mal",
                    source_name=sources[index].name,
                    source_url=sources[index].url,
                    items_total=0,
                    items_matched=0,
                    sync_status="error",
                    error_message=str(exc),
                )
        except Exception:
            pass

        raise HTTPException(status_code=500, detail=f"Sync failed: {str(exc)}") from exc


@router.get("/mal/sources/{index}/missing", response_model=list[MALMissingItemOut])
def get_missing_items_for_mal_source(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
) -> list[MALMissingItemOut]:
    # Get items from a MAL list that weren't found in Plex.
    try:
        from homescreen_hero.core.db import get_session
        from homescreen_hero.core.db.models import MALMissingItem

        config = load_config()
        sources = list(getattr(getattr(config, "mal", None), "sources", []) or [])

        if index < 0 or index >= len(sources):
            raise HTTPException(status_code=404, detail="MAL source not found")

        source = sources[index]

        with get_session() as session:
            results = session.query(MALMissingItem).filter(
                MALMissingItem.source_name == source.name,
                MALMissingItem.source_url == source.url
            ).order_by(MALMissingItem.last_seen.desc()).all()

            return [
                MALMissingItemOut(
                    title=item.title,
                    year=item.year,
                    media_type=item.media_type,
                    mal_id=item.mal_id,
                    anilist_id=item.anilist_id,
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
        logger.error("Error fetching missing items for MAL source at index %d: %s", index, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
