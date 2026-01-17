"""Config router package - handles all configuration-related API endpoints."""

from fastapi import APIRouter

from .settings import router as settings_router
from .sources import router as sources_router
from .groups import router as groups_router
from .setup import router as setup_router

# Create the main config router with prefix
router = APIRouter(prefix="/admin/config")

# Include all sub-routers (they don't have their own prefix, so endpoints remain flat)
router.include_router(settings_router)
router.include_router(sources_router)
router.include_router(groups_router)
router.include_router(setup_router)

__all__ = ["router"]
