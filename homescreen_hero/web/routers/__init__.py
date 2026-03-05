"""Router package for the web API."""

from .health import router as health_router
from .config import router as config_router
from .rotation import router as rotation_router
from .history import router as history_router
from .logs import router as logs_router
from .collections import router as collections_router
from .integrations import router as integrations_router
from .auth import router as auth_router
from .analytics import router as analytics_router
from .tools import router as tools_router
from .seerr import router as seerr_router
from .collection_io import router as collection_io_router
from .version import router as version_router

__all__ = [
    "analytics_router",
    "auth_router",
    "collection_io_router",
    "collections_router",
    "config_router",
    "health_router",
    "history_router",
    "integrations_router",
    "logs_router",
    "rotation_router",
    "seerr_router",
    "tools_router",
    "version_router",
]
