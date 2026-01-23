from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Depends

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.config.loader import (
    CONFIG_ENV_VAR,
    get_config_path,
    load_config,
)
from homescreen_hero.core.config.schema import (
    PlexSettings,
    RotationSettings,
    TraktSettings,
    LetterboxdSettings,
    MDBListSettings,
    TautulliSettings,
    SeerrSettings,
)
from homescreen_hero.core.scheduler import update_rotation_schedule

from .helpers import load_config_mapping, save_config_mapping
from .schemas import (
    ConfigSaveResponse,
    PlexConfigSaveRequest,
    TraktConfigSaveRequest,
    LetterboxdConfigSaveRequest,
    MDBListConfigSaveRequest,
    TautulliConfigSaveRequest,
    SeerrConfigSaveRequest,
    RotationConfigSaveRequest,
)

router = APIRouter()


# ========================================================================
# PLEX SETTINGS
# ========================================================================

@router.get("/plex", response_model=PlexSettings)
def get_plex_settings(current_user: str = Depends(get_current_user)) -> PlexSettings:
    # Return the currently configured Plex settings
    try:
        config = load_config()
        return config.plex
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/plex", response_model=ConfigSaveResponse)
def save_plex_settings(
    payload: PlexConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only Plex settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

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
        save_config_mapping(data)

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


# ========================================================================
# TRAKT SETTINGS
# ========================================================================

@router.get("/trakt", response_model=TraktSettings)
def get_trakt_settings(current_user: str = Depends(get_current_user)) -> TraktSettings:
    # Return the currently configured Trakt settings
    try:
        config = load_config()
        return config.trakt
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/trakt", response_model=ConfigSaveResponse)
def save_trakt_settings(
    payload: TraktConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only Trakt settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        trakt_section = data.get("trakt") if isinstance(data.get("trakt"), dict) else {}
        trakt_section = dict(trakt_section)

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
        save_config_mapping(data)

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


# ========================================================================
# LETTERBOXD SETTINGS
# ========================================================================

@router.get("/letterboxd", response_model=LetterboxdSettings)
def get_letterboxd_settings(current_user: str = Depends(get_current_user)) -> LetterboxdSettings:
    # Return the currently configured Letterboxd settings
    try:
        config = load_config()
        return config.letterboxd if config.letterboxd else LetterboxdSettings(enabled=False, sources=[])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/letterboxd", response_model=ConfigSaveResponse)
def save_letterboxd_settings(
    payload: LetterboxdConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only Letterboxd settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        letterboxd_section.update(
            enabled=payload.enabled,
        )

        data["letterboxd"] = letterboxd_section
        save_config_mapping(data)

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


# ========================================================================
# MDBLIST SETTINGS
# ========================================================================

@router.get("/mdblist", response_model=MDBListSettings)
def get_mdblist_settings(current_user: str = Depends(get_current_user)) -> MDBListSettings:
    # Return the currently configured MDBList settings
    try:
        config = load_config()
        if config.mdblist is None:
            return MDBListSettings(enabled=False, api_key=None, base_url="https://api.mdblist.com", sources=[])
        return config.mdblist
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mdblist", response_model=ConfigSaveResponse)
def save_mdblist_settings(
    payload: MDBListConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only MDBList settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        mdblist_section = data.get("mdblist") if isinstance(data.get("mdblist"), dict) else {}
        mdblist_section = dict(mdblist_section)

        # Only save api_key to config if it's not coming from environment variable
        api_key_from_env = os.getenv("HSH_MDBLIST_API_KEY")
        if api_key_from_env:
            # Don't write api_key to config if it's set in environment
            mdblist_section.pop("api_key", None)
        else:
            # Write api_key to config only if not using env var
            mdblist_section["api_key"] = payload.api_key

        mdblist_section.update(
            enabled=payload.enabled,
            base_url=payload.base_url,
        )

        data["mdblist"] = mdblist_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="MDBList settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# TAUTULLI SETTINGS
# ========================================================================

@router.get("/tautulli", response_model=TautulliSettings)
def get_tautulli_settings(current_user: str = Depends(get_current_user)) -> TautulliSettings:
    # Return the currently configured Tautulli settings
    try:
        config = load_config()
        if config.tautulli is None:
            return TautulliSettings(
                enabled=False,
                api_key=None,
                base_url="http://localhost:8181",
                collect_on_rotation=True,
                collect_interval_hours=24,
            )
        return config.tautulli
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/tautulli", response_model=ConfigSaveResponse)
def save_tautulli_settings(
    payload: TautulliConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only Tautulli settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        tautulli_section = data.get("tautulli") if isinstance(data.get("tautulli"), dict) else {}
        tautulli_section = dict(tautulli_section)

        # Only save api_key to config if it's not coming from environment variable
        api_key_from_env = os.getenv("HSH_TAUTULLI_API_KEY")
        if api_key_from_env:
            # Don't write api_key to config if it's set in environment
            tautulli_section.pop("api_key", None)
        else:
            # Write api_key to config only if not using env var
            tautulli_section["api_key"] = payload.api_key

        tautulli_section.update(
            enabled=payload.enabled,
            base_url=payload.base_url,
            collect_on_rotation=payload.collect_on_rotation,
            collect_interval_hours=payload.collect_interval_hours,
        )

        data["tautulli"] = tautulli_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Tautulli settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# SEERR SETTINGS
# ========================================================================

@router.get("/seerr", response_model=SeerrSettings)
def get_seerr_settings(current_user: str = Depends(get_current_user)) -> SeerrSettings:
    # Return the currently configured Seerr settings
    try:
        config = load_config()
        if config.seerr is None:
            return SeerrSettings(
                enabled=False,
                api_key=None,
                base_url="http://localhost:5055",
            )
        return config.seerr
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/seerr", response_model=ConfigSaveResponse)
def save_seerr_settings(
    payload: SeerrConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only Seerr settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        seerr_section = data.get("seerr") if isinstance(data.get("seerr"), dict) else {}
        seerr_section = dict(seerr_section)

        # Only save api_key to config if it's not coming from environment variable
        api_key_from_env = os.getenv("HSH_SEERR_API_KEY")
        if api_key_from_env:
            # Don't write api_key to config if it's set in environment
            seerr_section.pop("api_key", None)
        else:
            # Write api_key to config only if not using env var
            seerr_section["api_key"] = payload.api_key

        seerr_section.update(
            enabled=payload.enabled,
            base_url=payload.base_url,
        )

        data["seerr"] = seerr_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Seerr settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# ROTATION SETTINGS
# ========================================================================

@router.get("/rotation", response_model=RotationSettings)
def get_rotation_settings(current_user: str = Depends(get_current_user)) -> RotationSettings:
    # Return all rotation scheduler configuration settings
    try:
        config = load_config()
        return config.rotation
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/rotation", response_model=ConfigSaveResponse)
def save_rotation_settings(
    payload: RotationConfigSaveRequest,
    current_user: str = Depends(get_current_user)
) -> ConfigSaveResponse:
    # Update only global rotation settings while preserving other config keys
    try:
        data = load_config_mapping()

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
            sync_all_on_rotation=payload.sync_all_on_rotation,
            blacklisted_collections=payload.blacklisted_collections,
        )

        data["rotation"] = rotation_section
        save_config_mapping(data)

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
