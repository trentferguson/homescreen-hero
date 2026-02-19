from __future__ import annotations

import random
import logging
import requests
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from pydantic import BaseModel

from homescreen_hero.core.auth import (
    CurrentUser,
    create_access_token,
    get_current_user,
    require_admin,
    verify_password,
)
from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.db.base import session_scope
from homescreen_hero.core.db.models import User
from homescreen_hero.core.integrations.plex_client import get_plex_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Request/Response models ---

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str = "admin"
    thumb: Optional[str] = None


class UserResponse(BaseModel):
    username: str
    auth_enabled: bool
    method: Optional[str] = None
    role: str = "admin"
    thumb: Optional[str] = None


class AuthConfigResponse(BaseModel):
    auth_enabled: bool
    method: Optional[str] = None


class UserListItem(BaseModel):
    id: int
    plex_username: Optional[str] = None
    plex_email: Optional[str] = None
    plex_thumb: Optional[str] = None
    role: str
    status: str
    created_at: datetime
    last_login_at: Optional[datetime] = None


class UserListResponse(BaseModel):
    users: List[UserListItem]


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None


class PlexPinRequest(BaseModel):
    forward_url: str


class PlexPinResponse(BaseModel):
    pin_id: int
    oauth_url: str


class PlexCallbackRequest(BaseModel):
    pin_id: int


# --- DB helpers ---

def _upsert_plex_user(
    plex_id: int,
    username: str,
    email: str | None,
    thumb: str | None,
    role: str,
    status: str = "approved",
) -> User:
    # Create or update a user by plex_id. Never downgrades admin to user.
    # Status is only set on creation — existing users keep their current status.
    with session_scope() as db:
        user = db.query(User).filter(User.plex_id == plex_id).first()
        if user:
            user.plex_username = username
            user.plex_email = email
            user.plex_thumb = thumb
            user.last_login_at = datetime.utcnow()
            # Don't downgrade admin
            if role == "admin":
                user.role = "admin"
        else:
            user = User(
                plex_id=plex_id,
                plex_username=username,
                plex_email=email,
                plex_thumb=thumb,
                role=role,
                status=status,
                last_login_at=datetime.utcnow(),
            )
            db.add(user)
        db.flush()
        db.expunge(user)
        return user


# --- Auth config endpoint ---

@router.get("/config", response_model=AuthConfigResponse)
async def get_auth_config() -> AuthConfigResponse:
    # Public endpoint — tells the frontend what auth method is configured.
    config = load_config()
    if not config.auth or not config.auth.enabled:
        return AuthConfigResponse(auth_enabled=False)
    return AuthConfigResponse(
        auth_enabled=True,
        method=config.auth.method,
    )


# --- Password login ---

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest) -> LoginResponse:
    config = load_config()

    if not config.auth or not config.auth.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    # Reject password login if method is plex-only
    if config.auth.method == "plex":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password login is not enabled. Use Plex authentication.",
        )

    # Verify username
    if request.username != config.auth.username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # Verify password (supports both hashed and plaintext)
    stored_password = config.auth.password
    if stored_password.startswith("$2b$") or stored_password.startswith("$2a$"):
        if not verify_password(request.password, stored_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )
    else:
        if request.password != stored_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

    # Create JWT token (password users are always admin)
    expires_delta = timedelta(days=config.auth.token_expire_days)
    access_token = create_access_token(
        username=request.username,
        secret_key=config.auth.secret_key,
        expires_delta=expires_delta,
        user_id=0,
        role="admin",
    )

    return LoginResponse(
        access_token=access_token,
        username=request.username,
        role="admin",
    )


# --- Plex OAuth ---

@router.post("/plex/pin", response_model=PlexPinResponse)
async def create_plex_login_pin(request: PlexPinRequest, http_request: Request) -> PlexPinResponse:
    # Initiate Plex OAuth — creates a PIN and returns the OAuth URL.
    config = load_config()

    if not config.auth or not config.auth.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    if config.auth.method == "password":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plex login is not enabled. Use password authentication.",
        )

    # Validate forward_url is same-origin to prevent open redirect via Plex.
    # Use the Origin header (sent by browsers on POST) so this works behind
    # proxies and when the frontend dev server is on a different port.
    parsed_forward = urlparse(request.forward_url)
    origin_header = http_request.headers.get("origin")
    if origin_header:
        request_origin = urlparse(origin_header)
    else:
        request_origin = urlparse(str(http_request.base_url))
    if parsed_forward.netloc and parsed_forward.netloc != request_origin.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="forward_url must match the application origin",
        )

    from homescreen_hero.core.integrations.plex_auth import create_plex_pin

    try:
        result = create_plex_pin(request.forward_url)
        return PlexPinResponse(pin_id=result["pin_id"], oauth_url=result["oauth_url"])
    except Exception:
        logger.exception("Failed to create Plex OAuth PIN")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to connect to Plex.tv. Please try again later.",
        )


@router.post("/plex/callback", response_model=LoginResponse)
async def plex_oauth_callback(request: PlexCallbackRequest) -> LoginResponse:
    # Complete Plex OAuth — checks if the PIN was claimed, validates server access,
    # and issues a JWT token.
    config = load_config()

    if not config.auth or not config.auth.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication is not enabled",
        )

    if config.auth.method == "password":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plex login is not enabled. Use password authentication.",
        )

    from homescreen_hero.core.integrations.plex_auth import (
        check_plex_pin,
        validate_server_access,
    )

    # Check if the PIN has been claimed
    try:
        plex_token = check_plex_pin(request.pin_id)
    except Exception:
        logger.exception("Failed to check Plex PIN status")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to connect to Plex.tv. Please try again later.",
        )

    if not plex_token:
        return Response(
            content='{"status": "pending"}',
            status_code=200,
            media_type="application/json",
        )

    # Validate server access
    try:
        server = get_plex_server(config)
        machine_id = server.machineIdentifier
        result = validate_server_access(plex_token, config.plex.token, machine_id)
    except Exception:
        logger.exception("Failed to validate Plex server access")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to verify server access. Please try again.",
        )

    if not result["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this Plex server",
        )

    # Create/update user in DB
    role = "admin" if result["is_owner"] else "user"

    # Server owners are always approved; regular users depend on auto_approve setting
    auto_approve = config.auth.auto_approve_users if config.auth else True
    initial_status = "approved" if (role == "admin" or auto_approve) else "pending"

    user = _upsert_plex_user(
        plex_id=result["plex_id"],
        username=result["username"],
        email=result.get("email"),
        thumb=result.get("thumb"),
        role=role,
        status=initial_status,
    )

    # Don't issue a token for pending users
    if user.status == "pending":
        return Response(
            content='{"status": "pending_approval", "message": "Your account is pending admin approval."}',
            status_code=200,
            media_type="application/json",
        )

    # Issue JWT
    expires_delta = timedelta(days=config.auth.token_expire_days)
    access_token = create_access_token(
        username=user.plex_username,
        secret_key=config.auth.secret_key,
        expires_delta=expires_delta,
        user_id=user.id,
        role=user.role,
    )

    return LoginResponse(
        access_token=access_token,
        username=user.plex_username,
        role=user.role,
        thumb=user.plex_thumb,
    )


# --- User info ---

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser = Depends(get_current_user)) -> UserResponse:
    config = load_config()
    auth_enabled = config.auth is not None and config.auth.enabled
    method = config.auth.method if config.auth and config.auth.enabled else None

    # Try to get thumb from DB if this is a Plex user
    thumb = None
    if current_user.id > 0:
        try:
            with session_scope() as db:
                user = db.query(User).filter(User.id == current_user.id).first()
                if user:
                    thumb = user.plex_thumb
        except Exception:
            pass

    return UserResponse(
        username=current_user.username,
        auth_enabled=auth_enabled,
        method=method,
        role=current_user.role,
        thumb=thumb,
    )


# --- User management (admin only) ---

@router.get("/users", response_model=UserListResponse)
async def list_users(
    current_user: CurrentUser = Depends(require_admin),
) -> UserListResponse:
    with session_scope() as db:
        users = db.query(User).order_by(User.created_at.desc()).all()
        items = [
            UserListItem(
                id=u.id,
                plex_username=u.plex_username,
                plex_email=u.plex_email,
                plex_thumb=u.plex_thumb,
                role=u.role,
                status=u.status,
                created_at=u.created_at,
                last_login_at=u.last_login_at,
            )
            for u in users
        ]
    return UserListResponse(users=items)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    current_user: CurrentUser = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own account",
        )

    with session_scope() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if payload.role is not None:
            if payload.role not in ("admin", "user"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role must be 'admin' or 'user'",
                )
            user.role = payload.role

        if payload.status is not None:
            if payload.status not in ("approved", "pending"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'approved' or 'pending'",
                )
            user.status = payload.status

    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: CurrentUser = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    with session_scope() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        db.delete(user)

    return {"ok": True}


# --- Login page posters ---

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

                # Build the full Plex URL manually
                # item.thumb is just the path, we need to prepend the base URL
                base_url = config.plex.base_url.rstrip('/')
                thumb_path = item.thumb if item.thumb.startswith('/') else f"/{item.thumb}"
                token = config.plex.token
                actual_url = f"{base_url}{thumb_path}?X-Plex-Token={token}"

                logger.debug(f"Poster {idx}: base_url={base_url}, thumb_path={thumb_path}, final_url={actual_url}")

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
        response = requests.get(poster_url, timeout=10, verify=False)
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
