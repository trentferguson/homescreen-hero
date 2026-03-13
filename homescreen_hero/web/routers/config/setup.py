from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime

import yaml
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials

from homescreen_hero.core.auth import (
    CurrentUser,
    get_current_user,
    require_admin,
    security,
)
from homescreen_hero.core.config.loader import (
    CONFIG_ENV_VAR,
    get_config_path,
    load_config,
    load_config_text,
    save_config_text,
    validate_config_text,
)
from homescreen_hero.core.integrations.trakt_client import TraktClient, TraktConfig
from homescreen_hero.core.integrations.mdblist_client import MDBListClient, MDBListConfig
from homescreen_hero.core.integrations.tmdb_client import TMDbClient, TMDbConfig
from homescreen_hero.core.integrations.tautulli_client import TautulliClient, TautulliConfig
from homescreen_hero.core.integrations.seerr_client import SeerrClient, SeerrConfig
from homescreen_hero.core.scheduler import update_rotation_schedule

from .schemas import (
    ConfigFileResponse,
    ConfigSaveResponse,
    ConfigUpdateRequest,
    ConfigExistsResponse,
    ConfigValidateResponse,
    ConfigImportResponse,
    BackupStatusResponse,
    EnvVarsResponse,
    PlexTestRequest,
    TraktTestRequest,
    MDBListTestRequest,
    TautulliTestRequest,
    SeerrTestRequest,
    MALTestRequest,
    TMDbTestRequest,
    ConnectionTestResponse,
    QuickStartRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _is_initial_setup_open() -> bool:
    # Initial setup stays available only until a config file has been created once.
    return not get_config_path().exists()


def require_initial_setup_open() -> None:
    # Quick start is a one-time bootstrap path and must never reopen automatically.
    if not _is_initial_setup_open():
        raise HTTPException(
            status_code=403,
            detail="Initial setup has already been completed. Use the settings page to update configuration.",
        )


async def require_initial_setup_or_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser | None:
    # During first-run setup, allow helper endpoints without auth.
    # Once a config exists, require normal admin access.
    if _is_initial_setup_open():
        return None

    current_user = await get_current_user(credentials)
    return await require_admin(current_user)


# ========================================================================
# RAW CONFIG FILE OPERATIONS
# ========================================================================

@router.get("/file", response_model=ConfigFileResponse)
def read_config_file(
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigFileResponse:
    # Return the current configuration file contents
    try:
        content = load_config_text()
        return ConfigFileResponse(path=str(get_config_path()), content=content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/file", response_model=ConfigSaveResponse)
def save_config(
    payload: ConfigUpdateRequest,
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Validate and persist configuration updates provided as YAML text
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


# ========================================================================
# CONFIG BACKUP / RESTORE
# ========================================================================

@router.get("/export")
def export_config(
    current_user: CurrentUser = Depends(require_admin),
) -> Response:
    # Download the current config.yaml as a file attachment
    try:
        content = load_config_text()
        timestamp = datetime.now().strftime("%Y_%m_%d")
        filename = f"config_backup_{timestamp}.yaml"

        return Response(
            content=content,
            media_type="application/x-yaml",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/import")
def import_config(
    file: UploadFile = File(...),
    validate_only: bool = Query(False),
    current_user: CurrentUser = Depends(require_admin),
):
    # Import a config.yaml file, optionally just validating without applying
    MAX_CONFIG_SIZE = 1_048_576  # 1 MB
    try:
        raw = file.file.read(MAX_CONFIG_SIZE + 1)
        if len(raw) > MAX_CONFIG_SIZE:
            raise HTTPException(
                status_code=413, detail="Config file exceeds 1 MB size limit."
            )
        content = raw.decode("utf-8")
    except HTTPException:
        raise
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="File must be valid UTF-8 text."
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Failed to read file: {exc}"
        ) from exc

    # Validate the uploaded YAML (schema + env overrides)
    try:
        validate_config_text(content)
    except (yaml.YAMLError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Validation failed: {exc}"
        ) from exc

    if validate_only:
        return ConfigValidateResponse(
            ok=True,
            message="Configuration is valid and can be imported.",
        )

    # Backup current config before overwriting
    config_path = get_config_path()
    backup_path_str = None

    if config_path.exists():
        backup_path = config_path.with_suffix(".yaml.bak")
        try:
            shutil.copy2(config_path, backup_path)
            backup_path_str = str(backup_path)
            logger.info(f"Backed up current config to {backup_path}")
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create backup before import: {exc}",
            ) from exc

    # Apply the new config
    try:
        save_config_text(content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Update rotation schedule with new config
    try:
        updated_config = load_config()
        update_rotation_schedule(config=updated_config)
    except Exception as exc:
        logger.warning(f"Failed to update rotation schedule after import: {exc}")

    return ConfigImportResponse(
        ok=True,
        message="Configuration imported successfully.",
        backup_path=backup_path_str,
        env_override=CONFIG_ENV_VAR in os.environ,
    )


@router.get("/backup-status", response_model=BackupStatusResponse)
def get_backup_status(
    current_user: CurrentUser = Depends(require_admin),
) -> BackupStatusResponse:
    # Check if a .bak backup file exists and when it was last modified
    backup_path = get_config_path().with_suffix(".yaml.bak")
    if not backup_path.exists():
        return BackupStatusResponse(exists=False)

    modified_ts = backup_path.stat().st_mtime
    modified_at = datetime.fromtimestamp(modified_ts).isoformat()
    return BackupStatusResponse(exists=True, modified_at=modified_at)


@router.post("/revert", response_model=ConfigImportResponse)
def revert_config(
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigImportResponse:
    # Revert to the most recent .bak backup, backing up the current config first
    config_path = get_config_path()
    backup_path = config_path.with_suffix(".yaml.bak")

    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="No backup file found to revert to.")

    # Read and validate the backup before applying
    backup_content = backup_path.read_text(encoding="utf-8")
    try:
        validate_config_text(backup_content)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Backup file is not valid: {exc}"
        ) from exc

    # Swap: current -> .bak, backup -> current
    # Save current config to .bak so the user can revert the revert
    try:
        current_content = config_path.read_text(encoding="utf-8")
        save_config_text(backup_content)
        backup_path.write_text(current_content, encoding="utf-8")
        logger.info("Reverted config and swapped backup")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Update rotation schedule
    try:
        updated_config = load_config()
        update_rotation_schedule(config=updated_config)
    except Exception as exc:
        logger.warning(f"Failed to update rotation schedule after revert: {exc}")

    return ConfigImportResponse(
        ok=True,
        message="Configuration reverted successfully.",
        backup_path=str(backup_path),
        env_override=CONFIG_ENV_VAR in os.environ,
    )


# ========================================================================
# CONFIG STATUS & ENVIRONMENT
# ========================================================================

@router.get("/exists", response_model=ConfigExistsResponse)
def check_config_exists() -> ConfigExistsResponse:
    # Check whether the one-time initial setup has already been completed.
    try:
        config_path = get_config_path()
        exists = config_path.exists()

        return ConfigExistsResponse(
            exists=exists,
            is_configured=exists,
            path=str(config_path)
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/env-vars", response_model=EnvVarsResponse)
def check_env_vars(
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> EnvVarsResponse:
    # Check which configuration values are provided via environment variables.
    plex_url = os.getenv("HSH_PLEX_URL")
    return EnvVarsResponse(
        plex_token_from_env=bool(os.getenv("HSH_PLEX_TOKEN")),
        plex_url_from_env=bool(plex_url),
        plex_url_value=plex_url if plex_url else None,
        auth_password_from_env=bool(os.getenv("HSH_AUTH_PASSWORD")),
        auth_secret_from_env=bool(os.getenv("HSH_AUTH_SECRET_KEY")),
        trakt_client_id_from_env=bool(os.getenv("HSH_TRAKT_CLIENT_ID")),
        mdblist_api_key_from_env=bool(os.getenv("HSH_MDBLIST_API_KEY")),
        tmdb_api_key_from_env=bool(os.getenv("HSH_TMDB_API_KEY")),
        tautulli_api_key_from_env=bool(os.getenv("HSH_TAUTULLI_API_KEY")),
        tautulli_url_from_env=bool(os.getenv("HSH_TAUTULLI_BASE_URL")),
        seerr_api_key_from_env=bool(os.getenv("HSH_SEERR_API_KEY")),
        seerr_url_from_env=bool(os.getenv("HSH_SEERR_BASE_URL")),
        mal_client_id_from_env=bool(os.getenv("HSH_MAL_CLIENT_ID")),
    )


# ========================================================================
# CONNECTION TESTS
# ========================================================================

@router.post("/test-plex", response_model=ConnectionTestResponse)
def test_plex_connection(
    payload: PlexTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test Plex connection and return available libraries without writing config.
    try:
        from plexapi.server import PlexServer
        from homescreen_hero.core.integrations.plex_client import _make_session

        plex_url = payload.plex_url or os.getenv("HSH_PLEX_URL")
        plex_token = payload.plex_token or os.getenv("HSH_PLEX_TOKEN")
        if not plex_url or not plex_token:
            return ConnectionTestResponse(ok=False, error="Plex URL and token are required")

        server = PlexServer(plex_url, plex_token, session=_make_session(), timeout=10)
        libraries = [
            {"title": section.title, "type": section.type}
            for section in server.library.sections()
            if section.type != "artist"
        ]
        return ConnectionTestResponse(ok=True, libraries=libraries)
    except Exception as exc:
        logger.exception("Plex connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


@router.post("/test-trakt", response_model=ConnectionTestResponse)
def test_trakt_connection(
    payload: TraktTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test Trakt connection with provided credentials (for quick-start wizard).
    try:
        # Use provided client_id or fall back to environment variable
        client_id = payload.client_id or os.getenv("HSH_TRAKT_CLIENT_ID")
        if not client_id:
            return ConnectionTestResponse(ok=False, error="No Trakt Client ID provided")

        cfg = TraktConfig(client_id=client_id)
        client = TraktClient(cfg)
        ok, error = client.ping()
        return ConnectionTestResponse(ok=ok, error=error)
    except Exception as exc:
        logger.exception("Trakt connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


@router.post("/test-mdblist", response_model=ConnectionTestResponse)
def test_mdblist_connection(
    payload: MDBListTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test MDBList connection with provided credentials (for quick-start wizard).
    try:
        # Use provided api_key or fall back to environment variable
        api_key = payload.api_key or os.getenv("HSH_MDBLIST_API_KEY")
        if not api_key:
            return ConnectionTestResponse(ok=False, error="No MDBList API Key provided")

        cfg = MDBListConfig(api_key=api_key)
        client = MDBListClient(cfg)
        ok, error = client.ping()
        return ConnectionTestResponse(ok=ok, error=error)
    except Exception as exc:
        logger.exception("MDBList connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


@router.post("/test-tautulli", response_model=ConnectionTestResponse)
def test_tautulli_connection(
    payload: TautulliTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test Tautulli connection with provided credentials (for quick-start wizard).
    try:
        api_key = payload.api_key
        base_url = payload.base_url
        if not api_key:
            api_key = os.getenv("HSH_TAUTULLI_API_KEY")
            base_url = os.getenv("HSH_TAUTULLI_BASE_URL", "http://localhost:8181")
        if not api_key:
            return ConnectionTestResponse(ok=False, error="No Tautulli API Key provided")

        cfg = TautulliConfig(
            api_key=api_key,
            base_url=base_url,
        )
        client = TautulliClient(cfg)
        ok, error = client.ping()
        return ConnectionTestResponse(ok=ok, error=error)
    except Exception as exc:
        logger.exception("Tautulli connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


@router.post("/test-seerr", response_model=ConnectionTestResponse)
def test_seerr_connection(
    payload: SeerrTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test Seerr connection with provided credentials (for quick-start wizard).
    try:
        api_key = payload.api_key
        base_url = payload.base_url
        if not api_key:
            api_key = os.getenv("HSH_SEERR_API_KEY")
            base_url = os.getenv("HSH_SEERR_BASE_URL", "http://localhost:5055")
        if not api_key:
            return ConnectionTestResponse(ok=False, error="No Seerr API Key provided")

        cfg = SeerrConfig(
            api_key=api_key,
            base_url=base_url,
        )
        client = SeerrClient(cfg)
        ok, error = client.ping()
        return ConnectionTestResponse(ok=ok, error=error)
    except Exception as exc:
        logger.exception("Seerr connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


@router.post("/test-mal", response_model=ConnectionTestResponse)
def test_mal_connection(
    payload: MALTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test MAL connection with provided credentials (for quick-start wizard).
    try:
        from homescreen_hero.core.integrations.mal_client import MALClient, MALConfig

        # Use provided client_id or fall back to environment variable
        client_id = payload.client_id or os.getenv("HSH_MAL_CLIENT_ID")
        if not client_id:
            return ConnectionTestResponse(ok=False, error="No MAL Client ID provided")

        cfg = MALConfig(client_id=client_id)
        client = MALClient(cfg)
        ok, error = client.ping()
        return ConnectionTestResponse(ok=ok, error=error)
    except Exception as exc:
        logger.exception("MAL connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


@router.post("/test-tmdb", response_model=ConnectionTestResponse)
def test_tmdb_connection(
    payload: TMDbTestRequest,
    _current_user: CurrentUser | None = Depends(require_initial_setup_or_admin),
) -> ConnectionTestResponse:
    # Test TMDb connection with provided credentials.
    try:
        api_key = payload.api_key or os.getenv("HSH_TMDB_API_KEY")
        if not api_key:
            return ConnectionTestResponse(ok=False, error="No TMDb API Key provided")

        cfg = TMDbConfig(api_key=api_key)
        client = TMDbClient(cfg)
        ok, error = client.ping()
        return ConnectionTestResponse(ok=ok, error=error)
    except Exception as exc:
        logger.exception("TMDb connection test failed")
        return ConnectionTestResponse(ok=False, error=str(exc))


# ========================================================================
# QUICK START WIZARD
# ========================================================================

@router.post("/quick-start", response_model=ConfigSaveResponse)
def quick_start_setup(
    payload: QuickStartRequest,
    _initial_setup: None = Depends(require_initial_setup_open),
) -> ConfigSaveResponse:
    # Initialize config.yaml with minimal Plex and optional Trakt settings.
    try:
        # Initial setup lockout is enforced by the dependency above.
        # Keep config_path resolution here for the response payload below.
        config_path = get_config_path()

        # Use environment variables if payload values are empty
        plex_url = payload.plex_url or os.getenv("HSH_PLEX_URL", "")
        plex_token = payload.plex_token or os.getenv("HSH_PLEX_TOKEN", "")
        plex_token_from_env = os.getenv("HSH_PLEX_TOKEN")

        # Build minimal config structure
        # Convert library names to library config objects
        libraries_config = [{"name": lib, "enabled": True} for lib in payload.libraries]

        # Build rotation config with optional auto-rotate
        rotation_config = {
            "enabled": payload.rotation_enabled,
            "interval_hours": payload.rotation_interval_hours,
            "max_collections": payload.rotation_max_collections,
            "strategy": payload.rotation_strategy,
            "allow_repeats": payload.rotation_allow_repeats,
        }

        if payload.rotation_mode == "auto_rotate":
            rotation_config["auto_rotate"] = {
                "enabled": True,
                "libraries": payload.libraries,
                "visibility_home": payload.visibility_home,
                "visibility_shared": payload.visibility_shared,
                "visibility_recommended": payload.visibility_recommended,
            }

        minimal_config = {
            "plex": {
                "base_url": plex_url,
                "libraries": libraries_config
            },
            "rotation": rotation_config,
            "logging": {
                "level": "INFO"
            },
            "groups": []
        }

        # Only write plex token to config if not from environment variable
        if not plex_token_from_env:
            minimal_config["plex"]["token"] = plex_token

        # Auth is always required for new setups
        needs_password = payload.auth_method in ("password", "both")
        password_from_env = os.getenv("HSH_AUTH_PASSWORD")
        auth_password = payload.auth_password or password_from_env
        secret_from_env = os.getenv("HSH_AUTH_SECRET_KEY")

        # Validate that required auth credentials are provided
        if needs_password and not (payload.auth_username and auth_password):
            raise HTTPException(
                status_code=400,
                detail="Username and password are required for password authentication."
            )

        minimal_config["auth"] = {
            "enabled": True,
            "method": payload.auth_method,
            "username": payload.auth_username or "admin",
            "token_expire_days": 30,
        }

        # Only write password/secret to config if not using env vars
        if needs_password and not password_from_env:
            minimal_config["auth"]["password"] = payload.auth_password
        if not secret_from_env:
            import secrets
            minimal_config["auth"]["secret_key"] = secrets.token_urlsafe(32)

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
