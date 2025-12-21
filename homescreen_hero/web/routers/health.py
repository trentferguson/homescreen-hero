from __future__ import annotations

import logging
from typing import Any, Dict, Tuple

from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from plexapi.server import NotFound

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.db import init_db
from homescreen_hero.core.integrations.plex_client import get_plex_server
from homescreen_hero.core.integrations.trakt_client import get_trakt_client
from homescreen_hero.core.logging_config import level_from_name, setup_logging
from homescreen_hero.core.config.schema import HealthComponent, HealthResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Helper functions for general config file health checks
def _check_config() -> Tuple[HealthComponent, Any]:
    try:
        config = load_config()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("Config load failed during health check")
        return HealthComponent(ok=False, error=str(exc)), None

    try:
        _log_level = level_from_name(config.logging.level)
        setup_logging(level=_log_level, reconfigure=True)
    except Exception:
        logger.exception("Unable to reconfigure logging from health check")

    return HealthComponent(ok=True), config


# Helper function for database health check
def _check_database() -> HealthComponent:
    try:
        init_db()
        return HealthComponent(ok=True)
    except Exception as exc:
        logger.exception("Database initialization failed during health check")
        return HealthComponent(ok=False, error=str(exc))


# Helper function for Trakt health check
def _check_trakt(config: Any) -> HealthComponent:
    try:
        trakt_client = get_trakt_client(config)

        if trakt_client is None:
            return HealthComponent(ok=True, error="Trakt disabled or not configured")

        t_ok, t_error = trakt_client.ping()
        issues: list[str] = []

        if not t_ok:
            issues.append(f"Trakt ping failed: {t_error or 'unknown error'}")

        try:
            server = get_plex_server(config)

            if config.trakt and config.trakt.sources:
                for src in config.trakt.sources:
                    if not src.plex_library:
                        issues.append(f"Source '{src.name}' has no plex_library set")
                        continue

                    try:
                        server.library.section(src.plex_library)
                    except NotFound:
                        issues.append(
                            f"Source '{src.name}' uses unknown Plex library "
                            f"'{src.plex_library}'"
                        )
                    except Exception as exc:  # pragma: no cover - defensive
                        issues.append(
                            f"Source '{src.name}' failed library check "
                            f"'{src.plex_library}': {exc}"
                        )
        except Exception as exc:  # pragma: no cover - defensive
            issues.append(f"Failed to validate Trakt sources against Plex: {exc}")

        return (
            HealthComponent(ok=False, error="; ".join(issues))
            if issues
            else HealthComponent(ok=True)
        )

    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Trakt health check failed")
        return HealthComponent(
            ok=False, error=f"Unhandled error in Trakt health check: {exc}"
        )


# Helper function for Plex health check
def _check_plex(config: Any) -> HealthComponent:
    try:
        server = get_plex_server(config)
        library = server.library.section(config.plex.library_name)
        _ = library
        return HealthComponent(
            ok=True,
            details={
                "server_name": server.friendlyName,
                "library_name": config.plex.library_name,
            },
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Plex health check failed")
        return HealthComponent(ok=False, error=str(exc))


# Redirect the root path to the interactive API docs (still needed?)
@router.get("/", include_in_schema=False)
def root_redirect() -> RedirectResponse:
    return RedirectResponse(url="/docs", status_code=307)


# Validate configuration file can be loaded
@router.get("/health/config", response_model=HealthComponent)
def health_config() -> HealthComponent:
    component, _ = _check_config()
    return component


# Validate database connectivity
@router.get("/health/database", response_model=HealthComponent)
def health_database() -> HealthComponent:
    return _check_database()


# Validate Trakt connectivity and configured Plex library references
@router.get("/health/trakt", response_model=HealthComponent)
def health_trakt() -> HealthComponent:
    component, config = _check_config()
    if not component.ok:
        return HealthComponent(ok=False, error=component.error)

    return _check_trakt(config)


# Validate Plex connectivity and configured library is accessible
@router.get("/health/plex", response_model=HealthComponent)
def health_plex() -> HealthComponent:
    component, config = _check_config()
    if not component.ok:
        return HealthComponent(ok=False, error=component.error)

    return _check_plex(config)


# Perform dependency checks for configuration, DB, Trakt, and Plex
@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    components: Dict[str, HealthComponent] = {}

    config_component, config = _check_config()
    components["config"] = config_component

    if not config_component.ok:
        return HealthResponse(ok=False, components=components)

    db_component = _check_database()
    components["database"] = db_component
    if not db_component.ok:
        return HealthResponse(ok=False, components=components)

    components["trakt"] = _check_trakt(config)
    components["plex"] = _check_plex(config)

    overall_ok = all(component.ok for component in components.values())
    return HealthResponse(ok=overall_ok, components=components)
