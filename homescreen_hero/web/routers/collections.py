from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel
import logging

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.config.schema import HealthResponse
from homescreen_hero.core.db.history import init_db
from homescreen_hero.core.db.tools import list_rotations
from homescreen_hero.core.integrations.plex_client import get_plex_server


# NEW: response models
class ActiveCollectionOut(BaseModel):
    title: str
    library: Optional[str] = None
    poster_url: Optional[str] = None


class ActiveCollectionsResponse(BaseModel):
    collections: List[ActiveCollectionOut]


class CollectionOut(BaseModel):
    title: str
    library: str
    poster_url: Optional[str] = None
    item_count: int = 0
    is_active: bool = False


class AllCollectionsResponse(BaseModel):
    collections: List[CollectionOut]


class DashboardStat(BaseModel):
    label: str
    value: str
    hint: Optional[str] = None


class DashboardActivityItem(BaseModel):
    created_at: datetime
    success: bool
    summary: str
    error_message: Optional[str] = None


class DashboardUsageItem(BaseModel):
    collection_name: str
    times_used: int
    last_rotated_at: Optional[datetime] = None


class DashboardResponse(BaseModel):
    health: HealthResponse
    stats: list[DashboardStat]
    recent_activity: list[DashboardActivityItem]
    usage_top: list[DashboardUsageItem]

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collections")


# Return the collections currently featured on the Plex home screen
@router.get("/active", response_model=ActiveCollectionsResponse)
def get_active_collections() -> ActiveCollectionsResponse:
    init_db()

    # Get the most recent rotation record
    rows = list_rotations(limit=1)
    if not rows:
        return ActiveCollectionsResponse(collections=[])

    latest = rows[0]
    names = latest.featured_collections or []

    config = load_config()
    server = get_plex_server(config)

    by_title = {}
    for section in server.library.sections():
        try:
            for col in section.collections():
                by_title[col.title] = (col, section.title)
        except Exception:
            continue

    out: List[ActiveCollectionOut] = []
    for name in names:
        entry = by_title.get(name)
        poster_url = None
        library = None

        if entry:
            col, section_title = entry
            library = section_title
            if getattr(col, "thumb", None):
                poster_url = server.url(col.thumb, includeToken=True)

        out.append(
            ActiveCollectionOut(
                title=name,
                poster_url=poster_url,
                library=library,
            )
        )


    return ActiveCollectionsResponse(collections=out)


# Return all collections from the Plex library with their metadata, including active status.
@router.get("/all", response_model=AllCollectionsResponse)
def get_all_collections() -> AllCollectionsResponse:
    init_db()

    # Get currently active collection names
    active_names = set()
    rows = list_rotations(limit=1)
    if rows:
        latest = rows[0]
        active_names = set(latest.featured_collections or [])

    config = load_config()
    server = get_plex_server(config)

    collections: List[CollectionOut] = []

    # Iterate through all library sections
    for section in server.library.sections():
        try:
            for col in section.collections():
                poster_url = None
                if getattr(col, "thumb", None):
                    poster_url = server.url(col.thumb, includeToken=True)

                item_count = 0
                try:
                    item_count = len(col.items())
                except Exception as e:
                    logger.warning(f"Could not get item count for collection {col.title}: {e}")

                collections.append(
                    CollectionOut(
                        title=col.title,
                        library=section.title,
                        poster_url=poster_url,
                        item_count=item_count,
                        is_active=(col.title in active_names),
                    )
                )
        except Exception as e:
            logger.error(f"Error retrieving collections from section {section.title}: {e}")
            continue

    # Sort by library, then by title
    collections.sort(key=lambda c: (c.library, c.title))

    return AllCollectionsResponse(collections=collections)
