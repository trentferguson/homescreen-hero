from __future__ import annotations

import random
import logging
import requests
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from homescreen_hero.core.auth import (
    create_access_token,
    get_current_user,
    verify_password,
)
from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.plex_client import get_plex_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserResponse(BaseModel):
    username: str
    auth_enabled: bool


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest) -> LoginResponse:
    config = load_config()

    # Check if auth is configured and enabled
    if not config.auth or not config.auth.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    # Verify username
    if request.username != config.auth.username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Verify password
    # Check if the configured password is already hashed or plaintext
    stored_password = config.auth.password

    # If stored password looks like a hash, verify against hash
    if stored_password.startswith("$2b$") or stored_password.startswith("$2a$"):
        if not verify_password(request.password, stored_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )
    else:
        # Stored password is plaintext (not recommended, but we'll support it)
        if request.password != stored_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

    # Create JWT token
    expires_delta = timedelta(days=config.auth.token_expire_days)
    access_token = create_access_token(
        username=request.username,
        secret_key=config.auth.secret_key,
        expires_delta=expires_delta,
    )

    return LoginResponse(
        access_token=access_token,
        username=request.username,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: str = Depends(get_current_user)) -> UserResponse:
    config = load_config()
    auth_enabled = config.auth is not None and config.auth.enabled

    return UserResponse(
        username=current_user,
        auth_enabled=auth_enabled,
    )


class PosterResponse(BaseModel):
    posters: List[str]


@router.get("/posters", response_model=PosterResponse)
async def get_login_posters() -> PosterResponse:
    """
    Fetch random poster URLs from Plex collections for the login page background.
    This endpoint is intentionally unauthenticated to allow the login page to display posters.
    Returns proxied URLs that go through our backend.
    """
    try:
        config = load_config()
        server = get_plex_server(config)

        # Get enabled libraries
        enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

        if not enabled_libraries:
            logger.warning("No enabled libraries for posters")
            return PosterResponse(posters=[])

        # Pick a random library to fetch posters from
        library_name = random.choice(enabled_libraries)
        library = server.library.section(library_name)

        # Get all items from the library
        all_items = library.all()

        # Randomly sample up to 40 items
        sample_size = min(40, len(all_items))
        sampled_items = random.sample(all_items, sample_size)

        # Extract poster URLs and create proxied versions
        posters = []
        for idx, item in enumerate(sampled_items):
            if hasattr(item, 'thumb') and item.thumb:
                # Create a proxied URL that goes through our backend
                # We'll use the index as an identifier and cache the actual URLs
                poster_url = f"/api/auth/poster-proxy/{idx}"
                posters.append(poster_url)

                # Build the full URL for the poster
                # If thumb is already a full URL (like TMDb CDN), use it as-is
                if item.thumb.startswith('http://') or item.thumb.startswith('https://'):
                    actual_url = item.thumb
                else:
                    # Otherwise, construct a Plex-style URL
                    base_url = config.plex.base_url.rstrip('/')
                    thumb_path = item.thumb if item.thumb.startswith('/') else f"/{item.thumb}"
                    token = config.plex.token
                    actual_url = f"{base_url}{thumb_path}?X-Plex-Token={token}"

                logger.debug(f"Poster {idx}: thumb={item.thumb}, final_url={actual_url}")

                # Store in a simple dict cache (this should be Redis or similar in production)
                if not hasattr(get_login_posters, '_poster_cache'):
                    get_login_posters._poster_cache = {}
                get_login_posters._poster_cache[idx] = actual_url

        logger.info(f"Fetched {len(posters)} poster URLs for login page")
        return PosterResponse(posters=posters)

    except Exception as exc:
        logger.exception("Failed to fetch posters for login page")
        # Return empty list on error so login page still works
        return PosterResponse(posters=[])


@router.get("/poster-proxy/{poster_id}")
def proxy_poster(poster_id: int):
    """
    Proxy endpoint to serve poster images from Plex without requiring authentication.
    This allows the login page to display posters.
    """
    try:
        # Get the cached URL
        if not hasattr(get_login_posters, '_poster_cache'):
            raise HTTPException(status_code=404, detail="Poster not found")

        poster_url = get_login_posters._poster_cache.get(poster_id)
        if not poster_url:
            raise HTTPException(status_code=404, detail="Poster not found")

        # Fetch the image from Plex using requests
        response = requests.get(poster_url, timeout=10)
        response.raise_for_status()

        return Response(
            content=response.content,
            media_type=response.headers.get("content-type", "image/jpeg"),
            headers={
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
            }
        )

    except requests.RequestException as exc:
        logger.error(f"Failed to fetch poster {poster_id} from URL {poster_url}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch poster")
    except Exception as exc:
        logger.error(f"Unexpected error fetching poster {poster_id} from URL {poster_url}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch poster")
