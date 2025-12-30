from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Response, UploadFile, File, Form
from pydantic import BaseModel
import logging
import random
import requests
import tempfile
import os
from cachetools import TTLCache

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.config.schema import HealthResponse
from homescreen_hero.core.db.history import init_db
from homescreen_hero.core.db.tools import list_rotations
from homescreen_hero.core.integrations.plex_client import get_plex_server


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


# Collection Management Models
class CollectionItemOut(BaseModel):
    rating_key: str
    title: str
    year: Optional[int] = None
    thumb: Optional[str] = None
    type: str  # "movie" or "show"


class CollectionDetailResponse(BaseModel):
    title: str
    library: str
    summary: Optional[str] = None
    poster_url: Optional[str] = None
    sort_title: Optional[str] = None
    content_rating: Optional[str] = None
    labels: List[str] = []
    collection_mode: Optional[str] = None
    collection_order: Optional[str] = None
    item_count: int
    items: List[CollectionItemOut]


class LibraryItemOut(BaseModel):
    rating_key: str
    title: str
    year: Optional[int] = None
    thumb: Optional[str] = None
    type: str
    in_collection: bool = False


class LibrarySearchResponse(BaseModel):
    items: List[LibraryItemOut]
    total: int


class AddItemRequest(BaseModel):
    rating_key: str


class RemoveItemRequest(BaseModel):
    rating_key: str


class CreateCollectionRequest(BaseModel):
    title: str
    library: str
    summary: Optional[str] = None


class UpdateCollectionRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    sort_title: Optional[str] = None
    content_rating: Optional[str] = None
    labels: Optional[List[str]] = None
    collection_mode: Optional[str] = None  # "default", "hide", "hideItems", "showItems"
    collection_order: Optional[str] = None  # "release", "alpha", "custom"


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collections")

# TTL Cache for poster URLs: stores up to 1000 items, each expires after 1 hour (3600 seconds)
poster_url_cache = TTLCache(maxsize=1000, ttl=3600)

# TTL Cache for actual image content: stores up to 500 images, each expires after 1 hour
# Each image can be ~200KB, so 500 images = ~100MB in memory
poster_image_cache = TTLCache(maxsize=500, ttl=3600)

# Cache version counter - increment this to invalidate client-side caches
_cache_version = 0


class CacheVersionResponse(BaseModel):
    version: int


def invalidate_collections_cache():
    """
    Invalidate client-side collections cache by incrementing the version.
    This is a module-level function that can be called from other parts of the app.
    """
    global _cache_version
    _cache_version += 1
    logger.info(f"Collections cache invalidated. New version: {_cache_version}")
    return _cache_version


@router.get("/cache-version", response_model=CacheVersionResponse)
def get_cache_version() -> CacheVersionResponse:
    """Get the current cache version to check if client-side cache should be invalidated."""
    return CacheVersionResponse(version=_cache_version)


@router.post("/invalidate-cache")
def invalidate_cache_endpoint() -> dict:
    """API endpoint to invalidate client-side collections cache."""
    new_version = invalidate_collections_cache()
    return {"success": True, "version": new_version}


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
    # Proxy endpoint to serve poster images from Plex for group collections.
    try:
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
    

class LibraryOut(BaseModel):
    title: str
    type: str  # "movie" or "show"


class LibrariesResponse(BaseModel):
    libraries: List[LibraryOut]


# ============================================================================
# Collection Management Endpoints
# ============================================================================

@router.get("/libraries", response_model=LibrariesResponse)
def get_available_libraries() -> LibrariesResponse:
    """Get all available Plex library sections."""
    config = load_config()
    server = get_plex_server(config)

    try:
        libraries = []
        for section in server.library.sections():
            # Exclude music libraries (artist type)
            if section.type == "artist":
                logger.debug(f"Skipping music library: {section.title}")
                continue

            libraries.append(
                LibraryOut(
                    title=section.title,
                    type=section.type
                )
            )
            logger.debug(f"Added library: {section.title} (type: {section.type})")

        # Sort by title for consistent ordering
        libraries.sort(key=lambda lib: lib.title)

        return LibrariesResponse(libraries=libraries)

    except Exception as e:
        logger.error(f"Error getting libraries: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get libraries: {str(e)}"
        )

@router.get(
    "/{library}/{collection_title}/details", response_model=CollectionDetailResponse
)
def get_collection_details(
    library: str, collection_title: str
) -> CollectionDetailResponse:
    """Get detailed information about a specific collection, including all items."""
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        section = server.library.section(library)

        # Find the collection
        collection = None
        for col in section.collections():
            if col.title == collection_title:
                collection = col
                break

        if not collection:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_title}' not found in library '{library}'",
            )

        # Get all items in the collection
        items = collection.items()

        # Build response
        collection_items = []
        for item in items:
            thumb_url = None
            if hasattr(item, "thumb") and item.thumb:
                thumb_url = server.url(item.thumb, includeToken=True)

            collection_items.append(
                CollectionItemOut(
                    rating_key=str(item.ratingKey),
                    title=item.title,
                    year=getattr(item, "year", None),
                    thumb=thumb_url,
                    type=item.type,  # "movie" or "show"
                )
            )

        summary = getattr(collection, "summary", None)

        # Get poster URL
        poster_url = None
        if hasattr(collection, "thumb") and collection.thumb:
            poster_url = server.url(collection.thumb, includeToken=True)

        # Get additional metadata
        sort_title = getattr(collection, "titleSort", None)
        content_rating = getattr(collection, "contentRating", None)

        # Get labels
        labels = []
        if hasattr(collection, "labels"):
            labels = [label.tag for label in collection.labels]

        # Map collection mode from integer to string
        collection_mode = None
        mode_value = getattr(collection, "collectionMode", None)
        if mode_value is not None:
            mode_map = {-1: "default", 0: "hide", 1: "hideItems", 2: "showItems"}
            collection_mode = mode_map.get(mode_value)

        # Map collection order from integer to string
        collection_order = None
        order_value = getattr(collection, "collectionSort", None)
        if order_value is not None:
            order_map = {0: "release", 1: "alpha", 2: "custom"}
            collection_order = order_map.get(order_value)

        return CollectionDetailResponse(
            title=collection.title,
            library=library,
            summary=summary,
            poster_url=poster_url,
            sort_title=sort_title,
            content_rating=content_rating,
            labels=labels,
            collection_mode=collection_mode,
            collection_order=collection_order,
            item_count=len(collection_items),
            items=collection_items,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting collection details: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get collection details: {str(e)}"
        )
    
# Search for items in a library, optionally filtering by collection membership
@router.get("/{library}/search", response_model=LibrarySearchResponse)
def search_library_items(
    library: str,
    query: Optional[str] = None,
    collection_title: Optional[str] = None,
    limit: int = 50,
) -> LibrarySearchResponse:
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        logger.info(f"Searching library: {library}, query: {query}")
        section = server.library.section(library)
        logger.info(f"Found section: {section.title} (type: {section.type})")

        # Get items in the collection (if specified) to mark them
        collection_item_keys = set()
        if collection_title:
            for col in section.collections():
                if col.title == collection_title:
                    collection_item_keys = {str(item.ratingKey) for item in col.items()}
                    break

        # Search or get all items
        if query:
            items = section.search(title=query, limit=limit)
        else:
            items = section.all(limit=limit)

        logger.info(f"Found {len(items)} items in library {library}")

        # Build response
        library_items = []
        for idx, item in enumerate(items):
            thumb_url = None
            if hasattr(item, "thumb") and item.thumb:
                thumb_url = server.url(item.thumb, includeToken=True)

            # Log first few items to help debug
            if idx < 3:
                logger.info(f"Item {idx}: {item.title} (type: {item.type})")

            library_items.append(
                LibraryItemOut(
                    rating_key=str(item.ratingKey),
                    title=item.title,
                    year=getattr(item, "year", None),
                    thumb=thumb_url,
                    type=item.type,
                    in_collection=(str(item.ratingKey) in collection_item_keys),
                )
            )

        return LibrarySearchResponse(items=library_items, total=len(library_items))

    except Exception as e:
        logger.error(f"Error searching library: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to search library: {str(e)}"
        )
    

# Add an item to a collection
@router.post("/{library}/{collection_title}/add-item")
def add_item_to_collection(
    library: str, collection_title: str, request: AddItemRequest
) -> dict:
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        section = server.library.section(library)

        # Find the item by rating key
        item = section.fetchItem(int(request.rating_key))

        if not item:
            raise HTTPException(
                status_code=404,
                detail=f"Item with rating key '{request.rating_key}' not found",
            )

        # Add the item to the collection (creates collection if it doesn't exist)
        item.addCollection(collection_title)

        logger.info(f"Added '{item.title}' to collection '{collection_title}'")

        return {
            "success": True,
            "message": f"Added '{item.title}' to collection '{collection_title}'",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding item to collection: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to add item to collection: {str(e)}"
        )
    
# Remove an item from a collection
@router.post("/{library}/{collection_title}/remove-item")
def remove_item_from_collection(
    library: str, collection_title: str, request: RemoveItemRequest
) -> dict:
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        section = server.library.section(library)

        # Find the item by rating key
        item = section.fetchItem(int(request.rating_key))

        if not item:
            raise HTTPException(
                status_code=404,
                detail=f"Item with rating key '{request.rating_key}' not found",
            )

        # Remove the item from the collection
        item.removeCollection(collection_title)

        logger.info(f"Removed '{item.title}' from collection '{collection_title}'")

        return {
            "success": True,
            "message": f"Removed '{item.title}' from collection '{collection_title}'",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing item from collection: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to remove item from collection: {str(e)}"
        )


# Create a new collection
@router.post("/create")
def create_collection(request: CreateCollectionRequest) -> dict:
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        section = server.library.section(request.library)

        # Check if collection already exists
        for col in section.collections():
            if col.title == request.title:
                raise HTTPException(
                    status_code=409,
                    detail=f"Collection '{request.title}' already exists in library '{request.library}'",
                )

        # Create the collection by adding it to the first item in the library
        # Note: Plex collections require at least one item, so we keep the first item in the collection
        # Users can remove it later if they want an empty collection
        items = section.all(limit=1)
        if not items:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot create collection: library '{request.library}' is empty",
            )

        # Add collection to first item (this creates the collection)
        items[0].addCollection(request.title)

        # Find the newly created collection
        new_collection = None
        for col in section.collections():
            if col.title == request.title:
                new_collection = col
                break

        if not new_collection:
            raise HTTPException(
                status_code=500,
                detail="Failed to create collection"
            )

        # Set summary if provided
        if request.summary:
            new_collection.editSummary(request.summary)

        logger.info(
            f"Created collection '{request.title}' in library '{request.library}'"
        )

        return {"success": True, "message": f"Created collection '{request.title}'"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating collection: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create collection: {str(e)}"
        )


# Update collection metadata
@router.put("/{library}/{collection_title}")
def update_collection(
    library: str, collection_title: str, request: UpdateCollectionRequest
) -> dict:
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        section = server.library.section(library)

        # Find the collection
        collection = None
        for col in section.collections():
            if col.title == collection_title:
                collection = col
                break

        if not collection:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_title}' not found in library '{library}'",
            )

        # Apply edits using the new non-deprecated methods
        updated = False

        if request.title is not None:
            collection.editTitle(request.title)
            updated = True

        if request.summary is not None:
            collection.editSummary(request.summary)
            updated = True

        if request.sort_title is not None:
            collection.editSortTitle(request.sort_title)
            updated = True

        if request.content_rating is not None:
            collection.editContentRating(request.content_rating)
            updated = True

        # Handle labels - replace all labels
        if request.labels is not None:
            # Get current labels
            current_labels = [label.tag for label in collection.labels] if hasattr(collection, "labels") else []

            # Remove labels that aren't in the new list
            for label in current_labels:
                if label not in request.labels:
                    collection.removeLabel(label)

            # Add labels that aren't already present
            for label in request.labels:
                if label not in current_labels:
                    collection.addLabel(label)

            updated = True

        # Handle collection mode
        if request.collection_mode is not None:
            collection.modeUpdate(mode=request.collection_mode)
            updated = True

        # Handle collection order
        if request.collection_order is not None:
            collection.sortUpdate(sort=request.collection_order)
            updated = True

        if not updated:
            raise HTTPException(status_code=400, detail="No fields to update")

        logger.info(f"Updated collection '{collection_title}' in library '{library}'")

        return {"success": True, "message": f"Updated collection '{collection_title}'"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating collection: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update collection: {str(e)}"
        )


# Delete a collection
@router.delete("/{library}/{collection_title}")
def delete_collection(library: str, collection_title: str) -> dict:
    config = load_config()
    server = get_plex_server(config)

    try:
        # Get the library section
        section = server.library.section(library)

        # Find the collection
        collection = None
        for col in section.collections():
            if col.title == collection_title:
                collection = col
                break

        if not collection:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_title}' not found in library '{library}'",
            )

        # Delete the collection
        collection.delete()

        logger.info(f"Deleted collection '{collection_title}' from library '{library}'")

        return {"success": True, "message": f"Deleted collection '{collection_title}'"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting collection: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete collection: {str(e)}"
        )


# Upload a poster to a collection (from file or URL)
@router.post("/{library}/{collection_title}/upload-poster")
async def upload_collection_poster(
    library: str,
    collection_title: str,
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
) -> dict:
    """
    Upload a custom poster to a Plex collection.
    Either provide a file upload OR a URL to a poster image.
    """
    config = load_config()
    server = get_plex_server(config)

    try:
        # Validate that exactly one input method is provided
        if not file and not url:
            raise HTTPException(
                status_code=400,
                detail="Either 'file' or 'url' must be provided",
            )
        if file and url:
            raise HTTPException(
                status_code=400,
                detail="Provide either 'file' or 'url', not both",
            )

        # Get the library section
        section = server.library.section(library)

        # Find the collection
        collection = None
        for col in section.collections():
            if col.title == collection_title:
                collection = col
                break

        if not collection:
            raise HTTPException(
                status_code=404,
                detail=f"Collection '{collection_title}' not found in library '{library}'",
            )

        # Upload poster based on input method
        if url:
            # Upload from URL
            logger.info(f"Uploading poster from URL for collection '{collection_title}': {url}")
            collection.uploadPoster(url=url)
            logger.info(f"Successfully uploaded poster from URL for collection '{collection_title}'")
        else:
            # Upload from file
            logger.info(f"Uploading poster from file for collection '{collection_title}': {file.filename}")

            # Create a temporary file to save the uploaded content
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
                # Read and write the uploaded file content
                content = await file.read()
                temp_file.write(content)
                temp_file_path = temp_file.name

            try:
                # Upload the poster using the temporary file
                collection.uploadPoster(filepath=temp_file_path)
                logger.info(f"Successfully uploaded poster from file for collection '{collection_title}'")
            finally:
                # Clean up the temporary file
                try:
                    os.unlink(temp_file_path)
                except Exception as cleanup_error:
                    logger.warning(f"Failed to clean up temporary file: {cleanup_error}")

        # Invalidate caches to show the new poster
        invalidate_collections_cache()
        poster_url_cache.clear()
        poster_image_cache.clear()

        return {
            "success": True,
            "message": f"Successfully uploaded poster for collection '{collection_title}'",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading poster: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload poster: {str(e)}"
        )
