from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import logging
import random
import requests
from cachetools import TTLCache

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

# TTL Cache for poster URLs: stores up to 1000 items, each expires after 1 hour (3600 seconds)
poster_url_cache = TTLCache(maxsize=1000, ttl=3600)

# TTL Cache for actual image content: stores up to 500 images, each expires after 1 hour
# Each image can be ~200KB, so 500 images = ~100MB in memory
poster_image_cache = TTLCache(maxsize=500, ttl=3600)


# Return the collections currently featured on the Plex home screen
@router.get("/active", response_model=ActiveCollectionsResponse)
def get_active_collections() -> ActiveCollectionsResponse:
    config = load_config()
    server = get_plex_server(config)

    out: List[ActiveCollectionOut] = []

    # Iterate through all library sections and find collections visible on home
    for section in server.library.sections():
        try:
            for col in section.collections():
                try:
                    # Get the visibility/hub settings for this collection
                    hub = col.visibility()

                    # Check if this collection is visible on the home screen
                    # The attribute is 'promotedToOwnHome', not 'home'
                    if getattr(hub, "promotedToOwnHome", False):
                        poster_url = None
                        if getattr(col, "thumb", None):
                            poster_url = server.url(col.thumb, includeToken=True)

                        out.append(
                            ActiveCollectionOut(
                                title=col.title,
                                poster_url=poster_url,
                                library=section.title,
                            )
                        )
                except Exception as e:
                    logger.warning(f"Could not get visibility for collection {col.title}: {e}")
                    continue
        except Exception as e:
            logger.error(f"Error retrieving collections from section {section.title}: {e}")
            continue

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


class GroupPostersResponse(BaseModel):
    posters: List[str]


@router.get("/group-posters", response_model=GroupPostersResponse)
async def get_group_posters(collection_names: str) -> GroupPostersResponse:
    """
    Fetch random poster URLs from items within specified Plex collections.
    Collection names should be comma-separated.
    Returns proxied URLs that go through our backend.
    """
    try:
        config = load_config()
        server = get_plex_server(config)

        # Parse collection names from query parameter
        collections_to_fetch = [name.strip() for name in collection_names.split(',') if name.strip()]

        if not collections_to_fetch:
            return GroupPostersResponse(posters=[])

        # Collect all items from the specified collections
        all_items = []
        for section in server.library.sections():
            try:
                for col in section.collections():
                    if col.title in collections_to_fetch:
                        try:
                            items = col.items()
                            all_items.extend(items)
                        except Exception as e:
                            logger.warning(f"Could not get items for collection {col.title}: {e}")
                            continue
            except Exception as e:
                logger.error(f"Error retrieving collections from section {section.title}: {e}")
                continue

        if not all_items:
            return GroupPostersResponse(posters=[])

        # Randomly sample up to 6 items (1 row)
        sample_size = min(6, len(all_items))
        sampled_items = random.sample(all_items, sample_size)

        # Extract poster URLs and create proxied versions
        posters = []
        for idx, item in enumerate(sampled_items):
            if hasattr(item, 'thumb') and item.thumb:
                # Create a unique identifier using collection_names hash + idx
                cache_key = f"{hash(collection_names)}_{idx}"
                poster_url = f"/api/collections/group-poster-proxy/{cache_key}"
                posters.append(poster_url)

                # Build the full Plex URL
                base_url = config.plex.base_url.rstrip('/')
                thumb_path = item.thumb if item.thumb.startswith('/') else f"/{item.thumb}"
                token = config.plex.token
                actual_url = f"{base_url}{thumb_path}?X-Plex-Token={token}"

                # Store in TTL cache (expires after 1 hour)
                poster_url_cache[cache_key] = actual_url

        logger.info(f"Fetched {len(posters)} poster URLs for group collections: {collections_to_fetch}")
        return GroupPostersResponse(posters=posters)

    except Exception as exc:
        logger.exception("Failed to fetch posters for group collections")
        return GroupPostersResponse(posters=[])


@router.get("/group-poster-proxy/{cache_key}")
def proxy_group_poster(cache_key: str):
    """
    Proxy endpoint to serve poster images from Plex for group collections.
    Uses two-level TTL cache: first checks for cached image content, then fetches from Plex if needed.
    Also sets browser cache headers to avoid repeated requests.
    """
    try:
        # Check if we have the image content cached
        cached_image = poster_image_cache.get(cache_key)
        if cached_image:
            logger.debug(f"Serving cached image for key: {cache_key}")
            return Response(
                content=cached_image['content'],
                media_type=cached_image['media_type'],
                headers={
                    'Cache-Control': 'public, max-age=3600',  # Cache in browser for 1 hour
                    'ETag': cache_key  # Allow browser to revalidate if needed
                }
            )

        # Image not cached, get the URL from URL cache
        poster_url = poster_url_cache.get(cache_key)
        if not poster_url:
            logger.warning(f"Poster URL not found in cache for key: {cache_key}")
            raise HTTPException(status_code=404, detail="Poster not found or expired")

        # Fetch the image from Plex
        logger.debug(f"Fetching image from Plex for key: {cache_key}")
        response = requests.get(poster_url, timeout=10)
        response.raise_for_status()

        # Cache the image content
        media_type = response.headers.get('content-type', 'image/jpeg')
        poster_image_cache[cache_key] = {
            'content': response.content,
            'media_type': media_type
        }

        return Response(
            content=response.content,
            media_type=media_type,
            headers={
                'Cache-Control': 'public, max-age=3600',  # Cache in browser for 1 hour
                'ETag': cache_key  # Allow browser to revalidate if needed
            }
        )

    except requests.RequestException as e:
        logger.error(f"Failed to proxy poster {cache_key}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch poster from Plex")
    except Exception as e:
        logger.error(f"Unexpected error proxying poster {cache_key}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
