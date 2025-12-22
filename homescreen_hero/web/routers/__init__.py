"""Router package for the web API."""

from .health import router as health_router
from .config import router as config_router
from .rotation import router as rotation_router
from .history import router as history_router
from .logs import router as logs_router
from .collections import router as collections_router
from .auth import router as auth_router

__all__ = [
    "health_router",
    "config_router",
    "rotation_router",
    "history_router",
    "logs_router",
    "collections_router",
    "auth_router",
]
