from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from homescreen_hero.core.auth import (
    create_access_token,
    get_current_user,
    verify_password,
)
from homescreen_hero.core.config.loader import load_config

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
