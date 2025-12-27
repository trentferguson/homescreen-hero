from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import yaml
from dotenv import load_dotenv

from .schema import AppConfig


logger = logging.getLogger(__name__)

# Load .env file if it exists (for local development)
# Docker Compose will handle env vars automatically
env_file = Path(".env")
if env_file.exists():
    load_dotenv(env_file)
    logger.debug(f"Loaded environment variables from {env_file}")


# Default path to the config file.
DEFAULT_CONFIG_PATH = Path("config.yaml")

# Environment variable for config.yaml path override
CONFIG_ENV_VAR = "HOMESCREEN_HERO_CONFIG"

# Cached config to avoid repeated file reads
_cached_config: Optional[AppConfig] = None
_cached_config_path: Optional[Path] = None


def _resolve_config_path(path: Optional[Path | str] = None) -> Path:
    if path is not None:
        resolved = Path(path).expanduser().resolve()
        logger.debug(f"Using explicit config path: {resolved}")
        return resolved

    env_path = os.getenv(CONFIG_ENV_VAR)
    if env_path:
        resolved = Path(env_path).expanduser().resolve()
        logger.info(f"Using config path from {CONFIG_ENV_VAR}: {resolved}")
        return resolved

    resolved = DEFAULT_CONFIG_PATH.resolve()
    logger.debug(f"Using default config path: {resolved}")
    return resolved


# Helper to get the active config path
def get_config_path(path: Optional[Path | str] = None) -> Path:
    return _resolve_config_path(path)


def _read_raw_config(path: Path) -> dict:
    if not path.exists():
        logger.error(f"Config file not found at: {path}")
        raise FileNotFoundError(
            f"Config file not found at: {path}\n"
            f"Hint: Set {CONFIG_ENV_VAR} environment variable or create config.yaml"
        )

    if not path.is_file():
        raise ValueError(f"Config path exists but is not a file: {path}")

    try:
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError as exc:
        logger.error(f"Invalid YAML in config file: {exc}")
        raise ValueError(f"Invalid YAML in config file at {path}: {exc}") from exc
    except PermissionError as exc:
        logger.error(f"Permission denied reading config file: {path}")
        raise PermissionError(f"Cannot read config file at {path}: {exc}") from exc

    if data is None:
        raise ValueError(f"Config file at {path} is empty")

    if not isinstance(data, dict):
        raise ValueError(f"Config file at {path} must contain a mapping at the root")

    return data


# Apply environment variable overrides for sensitive fields
def _apply_env_overrides(config: AppConfig) -> AppConfig:
    # Plex URL override
    plex_url = os.getenv("HSH_PLEX_URL")
    if plex_url:
        logger.info("Using Plex URL from HSH_PLEX_URL environment variable")
        config.plex.base_url = plex_url
    elif not config.plex.base_url:
        raise ValueError(
            "Plex URL is required. Set it in config.yaml or via HSH_PLEX_URL environment variable"
        )

    # Plex token override
    plex_token = os.getenv("HSH_PLEX_TOKEN")
    if plex_token:
        logger.info("Using Plex token from HSH_PLEX_TOKEN environment variable")
        config.plex.token = plex_token
    elif not config.plex.token:
        raise ValueError(
            "Plex token is required. Set it in config.yaml or via HSH_PLEX_TOKEN environment variable"
        )

    # Auth password override
    if config.auth and config.auth.enabled:
        auth_password = os.getenv("HSH_AUTH_PASSWORD")
        if auth_password:
            logger.info("Using auth password from HSH_AUTH_PASSWORD environment variable")
            config.auth.password = auth_password
        elif not config.auth.password:
            raise ValueError(
                "Auth password is required when auth is enabled. Set it in config.yaml or via HSH_AUTH_PASSWORD environment variable"
            )

        # Auth secret key override
        auth_secret = os.getenv("HSH_AUTH_SECRET_KEY")
        if auth_secret:
            logger.info("Using auth secret key from HSH_AUTH_SECRET_KEY environment variable")
            config.auth.secret_key = auth_secret
        elif not config.auth.secret_key:
            raise ValueError(
                "Auth secret key is required when auth is enabled. Set it in config.yaml or via HSH_AUTH_SECRET_KEY environment variable"
            )

    # Trakt client ID override (if Trakt is enabled)
    if config.trakt and config.trakt.enabled:
        trakt_client_id = os.getenv("HSH_TRAKT_CLIENT_ID")
        if trakt_client_id:
            logger.info("Using Trakt client ID from HSH_TRAKT_CLIENT_ID environment variable")
            config.trakt.client_id = trakt_client_id
        elif not config.trakt.client_id:
            raise ValueError(
                "Trakt client ID is required when Trakt is enabled. Set it in config.yaml or via HSH_TRAKT_CLIENT_ID environment variable"
            )

    return config


def _validate_config_dict(raw_data: dict) -> AppConfig:
    try:
        config = AppConfig.model_validate(raw_data)  # pydantic v2
    except AttributeError:
        config = AppConfig.parse_obj(raw_data)  # pydantic v1

    # Apply environment variable overrides
    config = _apply_env_overrides(config)

    logger.info("Config validation successful")
    return config


# Return the raw config.yaml as text
def load_config_text(path: Optional[Path | str] = None) -> str:
    config_path = _resolve_config_path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found at: {config_path}")

    return config_path.read_text(encoding="utf-8")


# Save config as text after validation
def save_config_text(content: str, path: Path | None = None) -> AppConfig:
    global _cached_config, _cached_config_path

    cfg_path = path if path is not None else get_config_path()
    cfg_path = Path(cfg_path)

    data = yaml.safe_load(content)
    if data is None or not isinstance(data, dict):
        raise ValueError("Config content must be a YAML mapping at the top level")

    try:
        config = AppConfig.model_validate(data)
    except AttributeError:
        config = AppConfig.parse_obj(data)

    # Apply environment variable overrides for validation
    config = _apply_env_overrides(config) 

    tmp_path = cfg_path.with_suffix(cfg_path.suffix + ".tmp")
    tmp_path.write_text(content, encoding="utf-8")
    os.replace(tmp_path, cfg_path)

    _cached_config = None  # Clear cached config
    _cached_config_path = None # Clear cached path

    return config


def load_config(path: Optional[Path | str] = None, force_reload: bool = False) -> AppConfig:
    global _cached_config, _cached_config_path
    
    config_path = _resolve_config_path(path)

    # Use cached config if available and path matches
    if not force_reload and _cached_config is not None and _cached_config_path == config_path:
        logger.debug("Using cached config")
        return _cached_config

    logger.info(f"Loading config from {config_path}")
    raw_data = _read_raw_config(config_path)
    app_config = _validate_config_dict(raw_data)
    
    # Cache the result
    _cached_config = app_config
    _cached_config_path = config_path
    
    return app_config


# Force reload the config, ignoring cache
def reload_config(path: Optional[Path | str] = None) -> AppConfig:
    logger.info("Forcing config reload")
    return load_config(path, force_reload=True)
