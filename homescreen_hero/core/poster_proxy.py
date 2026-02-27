import hashlib
import logging
import requests
from cachetools import TTLCache
from fastapi import HTTPException, Response

logger = logging.getLogger(__name__)

# TTL Cache for poster URLs: stores up to 1000 items, each expires after 1 hour (3600 seconds)
poster_url_cache = TTLCache(maxsize=1000, ttl=3600)

# TTL Cache for actual image content: stores up to 500 images, each expires after 1 hour
# Each image can be ~200KB, so 500 images = ~100MB in memory
poster_image_cache = TTLCache(maxsize=500, ttl=3600)


def create_proxy_url(plex_url: str) -> str:
    # Store a Plex URL in cache and return a proxied URL the frontend can use.
    # The Plex token stays server-side; the frontend only sees a hash key.
    cache_key = hashlib.md5(plex_url.encode()).hexdigest()
    poster_url_cache[cache_key] = plex_url
    return f"/api/collections/poster-proxy/{cache_key}"


def serve_proxy_poster(cache_key: str) -> Response:
    # Serve a cached poster image, or fetch it from Plex if not cached.
    try:
        cached_image = poster_image_cache.get(cache_key)
        if cached_image:
            logger.debug(f"Serving cached image for key: {cache_key}")
            return Response(
                content=cached_image['content'],
                media_type=cached_image['media_type'],
                headers={
                    'Cache-Control': 'public, max-age=3600',
                    'ETag': cache_key
                }
            )

        poster_url = poster_url_cache.get(cache_key)
        if not poster_url:
            logger.warning(f"Poster URL not found in cache for key: {cache_key}")
            raise HTTPException(status_code=404, detail="Poster not found or expired")

        logger.debug(f"Fetching image from Plex for key: {cache_key}")
        response = requests.get(poster_url, timeout=10, verify=False)
        response.raise_for_status()

        media_type = response.headers.get('content-type', 'image/jpeg')
        poster_image_cache[cache_key] = {
            'content': response.content,
            'media_type': media_type
        }

        return Response(
            content=response.content,
            media_type=media_type,
            headers={
                'Cache-Control': 'public, max-age=3600',
                'ETag': cache_key
            }
        )

    except HTTPException:
        raise
    except requests.RequestException as e:
        logger.error(f"Failed to proxy poster {cache_key}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch poster from Plex")
    except Exception as e:
        logger.error(f"Unexpected error proxying poster {cache_key}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


def build_collection_poster_url(server, col) -> str | None:
    # Build a proxied poster URL for a Plex collection object.
    # Returns None if the collection has no thumbnail.
    if not getattr(col, "thumb", None):
        return None
    try:
        full_thumb_url = server.url(col.thumb, includeToken=True)
        plex_url = server.transcodeImage(full_thumb_url, height=450, width=300, minSize=1)
    except Exception:
        plex_url = server.url(col.thumb, includeToken=True)
    return create_proxy_url(plex_url)


def invalidate_poster_caches():
    # Clear both poster caches (e.g. after a poster upload).
    poster_url_cache.clear()
    poster_image_cache.clear()
