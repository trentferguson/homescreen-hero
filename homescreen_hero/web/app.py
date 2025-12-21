from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, Response

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.db.history import init_db
from homescreen_hero.core.logging_config import level_from_name, setup_logging
from homescreen_hero.core.scheduler import (
    start_rotation_scheduler,
    stop_rotation_scheduler,
)
from homescreen_hero.web.routers import (
    config_router,
    health_router,
    history_router,
    logs_router,
    rotation_router,
    collections_router,
)

logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"


def create_app() -> FastAPI:
    try:
        _config_for_logging = load_config()
        _log_level = level_from_name(_config_for_logging.logging.level)
        setup_logging(level=_log_level)
    except Exception as exc:  # pragma: no cover
        setup_logging()
        logger.warning(
            "Failed to load config during startup, using default logging: %s", exc
        )

    app = FastAPI(title="HomeScreen Hero API", version="0.2.0")


    app.include_router(health_router, prefix="/api")
    app.include_router(config_router, prefix="/api")
    app.include_router(rotation_router, prefix="/api")
    app.include_router(history_router, prefix="/api")
    app.include_router(logs_router, prefix="/api")
    app.include_router(collections_router, prefix="/api")

    # Frontend (serve only if build exists)
    logger.info(
        "FRONTEND_DIR=%s exists=%s index=%s",
        FRONTEND_DIR,
        FRONTEND_DIR.exists(),
        FRONTEND_INDEX.exists(),
    )

    if FRONTEND_INDEX.exists():
        assets_dir = FRONTEND_DIR / "assets"

        # Serve Vite assets at /assets/*
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        # Serve index at /
        @app.get("/", include_in_schema=False)
        async def serve_index() -> FileResponse:
            return FileResponse(str(FRONTEND_INDEX))

        # SPA fallback + root static files (logo.svg, favicon.ico, etc.)
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str) -> Response:
            if full_path.startswith("api/"):
                return Response(status_code=404)

            candidate = FRONTEND_DIR / full_path
            if candidate.exists() and candidate.is_file():
                return FileResponse(str(candidate))

            return FileResponse(str(FRONTEND_INDEX))
    else:
        logger.warning(
            "Frontend build not found at %s. API remains available, but UI will 404.",
            FRONTEND_INDEX,
        )

    @app.on_event("startup")
    async def _start_scheduler() -> None:  # pragma: no cover
        init_db()
        try:
            start_rotation_scheduler()
        except Exception as exc:  # pragma: no cover
            logger.exception("Failed to start rotation scheduler: %s", exc)

    @app.on_event("shutdown")
    async def _stop_scheduler() -> None:  # pragma: no cover
        stop_rotation_scheduler()

    return app


app = create_app()
