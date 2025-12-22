from __future__ import annotations

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
    username: str, secret_key: str, expires_delta: timedelta
) -> str:
    # Create a JWT access token
    expire = datetime.utcnow() + expires_delta
    to_encode = {
        "sub": username,  # Subject (username)
        "exp": expire,  # Expiration time
    }
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, secret_key: str) -> Optional[str]:
    # Verify a JWT token and return the username if valid.
    # Returns None if the token is invalid or expired.
    try:
        payload = jwt.decode(token, secret_key, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    config = load_config()

    # If auth is not enabled or not configured, allow access
    if not config.auth or not config.auth.enabled:
        return "anonymous"

    # Auth is enabled, so we need a valid token
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    username = verify_token(token, config.auth.secret_key)

    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return username
