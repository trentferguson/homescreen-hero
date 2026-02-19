from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from homescreen_hero.core.config.loader import load_config

# Password hashing context using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme (for extracting "Authorization: Bearer <token>" headers)
security = HTTPBearer(auto_error=False)

# JWT algorithm
ALGORITHM = "HS256"


@dataclass
class CurrentUser:
    id: int
    username: str
    role: str  # "admin" or "user"
    plex_id: int | None = field(default=None)

    def __str__(self) -> str:
        return self.username


def hash_password(password: str) -> str:
    # Hash a plaintext password (bcrypt)
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Verify a plaintext password against a hashed password
    return pwd_context.verify(plain_password, hashed_password)


def is_password_hashed(password: str) -> bool:
    # Check if a password string is already hashed (bcrypt hashes start with $2b$)
    return password.startswith("$2b$") or password.startswith("$2a$")


def create_access_token(
    username: str,
    secret_key: str,
    expires_delta: timedelta,
    user_id: int = 0,
    role: str = "admin",
) -> str:
    # Create a JWT access token with user identity and role
    expire = datetime.utcnow() + expires_delta
    to_encode = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, secret_key: str) -> Optional[CurrentUser]:
    # Verify a JWT token and return a CurrentUser if valid.
    # Handles both new (sub=user_id, username, role) and legacy (sub=username) formats.
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            return None

        # New format: sub is a numeric user_id string, username and role are separate claims
        username = payload.get("username")
        if username:
            return CurrentUser(
                id=int(sub),
                username=username,
                role=payload.get("role", "admin"),
            )

        # Legacy format: sub is the username string, assume admin
        return CurrentUser(id=0, username=sub, role="admin")
    except (JWTError, ValueError):
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> CurrentUser:
    config = load_config()

    # If auth is not enabled or not configured, allow access
    if not config.auth or not config.auth.enabled:
        return CurrentUser(id=0, username="anonymous", role="admin")

    # Auth is enabled, so we need a valid token
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    user = verify_token(token, config.auth.secret_key)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # For Plex users (id > 0), verify they still exist and are approved
    if user.id > 0:
        from homescreen_hero.core.db.base import session_scope
        from homescreen_hero.core.db.models import User as UserModel

        with session_scope() as db:
            db_user = db.query(UserModel).filter(UserModel.id == user.id).first()
            if db_user is None or db_user.status != "approved":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is not active",
                )

    return user


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    # Dependency that requires the current user to be an admin
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
