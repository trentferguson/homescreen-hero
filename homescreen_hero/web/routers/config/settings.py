from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Depends

from homescreen_hero.core.auth import CurrentUser, require_admin
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
    TMDbSettings,
    AniListSettings,
    MALSettings,
    TautulliSettings,
    SeerrSettings,
    DisplaySettings,
    AuthSettings,
)
from homescreen_hero.core.scheduler import update_rotation_schedule

from .helpers import load_config_mapping, save_config_mapping
from .schemas import (
    ConfigSaveResponse,
    PlexConfigSaveRequest,
    TraktConfigSaveRequest,
    LetterboxdConfigSaveRequest,
    MDBListConfigSaveRequest,
    TMDbConfigSaveRequest,
    AniListConfigSaveRequest,
    MALConfigSaveRequest,
    TautulliConfigSaveRequest,
    SeerrConfigSaveRequest,
    RotationConfigSaveRequest,
    DisplaySettingsSaveRequest,
    AuthSettingsResponse,
    AuthSettingsSaveRequest,
)

router = APIRouter()


# ========================================================================
# PLEX SETTINGS
# ========================================================================

@router.get("/plex", response_model=PlexSettings)
def get_plex_settings(_current_user: CurrentUser = Depends(require_admin)) -> PlexSettings:
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
    _current_user: CurrentUser = Depends(require_admin)
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
def get_trakt_settings(_current_user: CurrentUser = Depends(require_admin)) -> TraktSettings:
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
    _current_user: CurrentUser = Depends(require_admin)
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
def get_letterboxd_settings(_current_user: CurrentUser = Depends(require_admin)) -> LetterboxdSettings:
    # Return the currently configured Letterboxd settings
    try:
        config = load_config()
        return config.letterboxd if config.letterboxd else LetterboxdSettings(sources=[])
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/letterboxd", response_model=ConfigSaveResponse)
def save_letterboxd_settings(
    payload: LetterboxdConfigSaveRequest,
    _current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Update only Letterboxd settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        letterboxd_section = data.get("letterboxd") if isinstance(data.get("letterboxd"), dict) else {}
        letterboxd_section = dict(letterboxd_section)

        # No settings to update (Letterboxd is credential-free)

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
def get_mdblist_settings(_current_user: CurrentUser = Depends(require_admin)) -> MDBListSettings:
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
    _current_user: CurrentUser = Depends(require_admin)
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
# TMDB SETTINGS
# ========================================================================

@router.get("/tmdb", response_model=TMDbSettings)
def get_tmdb_settings(_current_user: CurrentUser = Depends(require_admin)) -> TMDbSettings:
    # Return the currently configured TMDb settings
    try:
        config = load_config()
        if config.tmdb is None:
            # Still surface the env var so the UI shows the masked key
            env_key = os.getenv("HSH_TMDB_API_KEY") or None
            return TMDbSettings(enabled=False, api_key=env_key, base_url="https://api.themoviedb.org/3", sources=[])
        return config.tmdb
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/tmdb", response_model=ConfigSaveResponse)
def save_tmdb_settings(
    payload: TMDbConfigSaveRequest,
    _current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Update only TMDb settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        tmdb_section = data.get("tmdb") if isinstance(data.get("tmdb"), dict) else {}
        tmdb_section = dict(tmdb_section)

        # Only save api_key to config if it's not coming from environment variable
        api_key_from_env = os.getenv("HSH_TMDB_API_KEY")
        if api_key_from_env:
            tmdb_section.pop("api_key", None)
        else:
            tmdb_section["api_key"] = payload.api_key

        tmdb_section.update(
            enabled=payload.enabled,
            base_url=payload.base_url,
        )

        data["tmdb"] = tmdb_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="TMDb settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# ANILIST SETTINGS
# ========================================================================

@router.get("/anilist", response_model=AniListSettings)
def get_anilist_settings(_current_user: CurrentUser = Depends(require_admin)) -> AniListSettings:
    # Return the currently configured AniList settings
    try:
        config = load_config()
        if config.anilist is None:
            return AniListSettings(sources=[])
        return config.anilist
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/anilist", response_model=ConfigSaveResponse)
def save_anilist_settings(
    payload: AniListConfigSaveRequest,
    _current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Update only AniList settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        anilist_section = data.get("anilist") if isinstance(data.get("anilist"), dict) else {}
        anilist_section = dict(anilist_section)

        # No settings to update (AniList is credential-free)

        data["anilist"] = anilist_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="AniList settings saved and validated.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# MAL SETTINGS
# ========================================================================

@router.get("/mal", response_model=MALSettings)
def get_mal_settings(_current_user: CurrentUser = Depends(require_admin)) -> MALSettings:
    # Return the currently configured MAL settings
    try:
        config = load_config()
        if config.mal is None:
            return MALSettings(enabled=False, client_id=None, sources=[])
        return config.mal
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/mal", response_model=ConfigSaveResponse)
def save_mal_settings(
    payload: MALConfigSaveRequest,
    _current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Update only MAL settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()

        mal_section = data.get("mal") if isinstance(data.get("mal"), dict) else {}
        mal_section = dict(mal_section)

        # Only save client_id to config if it's not coming from environment variable
        client_id_from_env = os.getenv("HSH_MAL_CLIENT_ID")
        if client_id_from_env:
            # Don't write client_id to config if it's set in environment
            mal_section.pop("client_id", None)
        else:
            # Write client_id to config only if not using env var
            mal_section["client_id"] = payload.client_id

        mal_section.update(
            enabled=payload.enabled,
        )

        data["mal"] = mal_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="MAL settings saved and validated.",
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
def get_tautulli_settings(_current_user: CurrentUser = Depends(require_admin)) -> TautulliSettings:
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
    _current_user: CurrentUser = Depends(require_admin)
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
def get_seerr_settings(_current_user: CurrentUser = Depends(require_admin)) -> SeerrSettings:
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
    _current_user: CurrentUser = Depends(require_admin)
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
def get_rotation_settings(_current_user: CurrentUser = Depends(require_admin)) -> RotationSettings:
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
    _current_user: CurrentUser = Depends(require_admin)
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
            group_order=payload.group_order,
            allow_repeats=payload.allow_repeats,
            sync_all_on_rotation=payload.sync_all_on_rotation,
            blacklisted_collections=payload.blacklisted_collections,
            auto_rotate=payload.auto_rotate.model_dump(),
            per_library_limits=payload.per_library_limits,
        )

        # Clean up legacy/deprecated fields from YAML
        rotation_section.pop("strategy", None)
        rotation_section.pop("randomize_group_order", None)
        rotation_section.pop("collection_selection", None)

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


# ========================================================================
# DISPLAY SETTINGS
# ========================================================================

@router.get("/display", response_model=DisplaySettings)
def get_display_settings(_current_user: CurrentUser = Depends(require_admin)) -> DisplaySettings:
    # Return the currently configured display settings
    try:
        config = load_config()
        return config.display
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/display", response_model=ConfigSaveResponse)
def save_display_settings(
    payload: DisplaySettingsSaveRequest,
    _current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Update display settings in config.yaml while preserving other keys
    try:
        data = load_config_mapping()
        data["display"] = payload.model_dump()
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Display settings saved.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# AUTH METHOD
# ========================================================================

@router.get("/auth-method", response_model=AuthSettingsResponse)
def get_auth_settings(_current_user: CurrentUser = Depends(require_admin)) -> AuthSettingsResponse:
    # Return the currently configured auth settings
    try:
        config = load_config()
        method = config.auth.method if config.auth else "password"
        auto_approve = config.auth.auto_approve_users if config.auth else True
        return AuthSettingsResponse(method=method, auto_approve_users=auto_approve)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/auth-method", response_model=ConfigSaveResponse)
def save_auth_settings(
    payload: AuthSettingsSaveRequest,
    _current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Update auth settings in config.yaml, preserving sensitive fields
    try:
        data = load_config_mapping()

        auth_section = data.get("auth") if isinstance(data.get("auth"), dict) else {}
        auth_section = dict(auth_section)
        auth_section["method"] = payload.method
        auth_section["auto_approve_users"] = payload.auto_approve_users

        data["auth"] = auth_section
        save_config_mapping(data)

        config_path = get_config_path()
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message="Auth method saved.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc
