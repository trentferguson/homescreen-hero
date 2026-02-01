from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Cache GitHub response for 1 hour to avoid rate limits
_github_cache: dict[str, tuple[float, Optional[str]]] = {}
CACHE_TTL_SECONDS = 3600
GITHUB_REPO = "trentferguson/homescreen-hero"


class VersionResponse(BaseModel):
    current_version: str
    latest_version: Optional[str] = None
    update_available: bool = False
    release_url: Optional[str] = None


def get_current_version() -> str:
    # Look for VERSION file relative to the package root
    version_paths = [
        Path(__file__).resolve().parents[3] / "VERSION",  # repo root from routers/
        Path("/app/VERSION"),  # Docker container path
        Path("VERSION"),  # Current working directory fallback
    ]

    for version_path in version_paths:
        if version_path.exists():
            return version_path.read_text().strip()

    return "unknown"


def _fetch_latest_release() -> Optional[str]:
    cache_key = "latest_release"
    now = time.time()

    # Check cache
    if cache_key in _github_cache:
        cached_time, cached_version = _github_cache[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return cached_version

    try:
        url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
        response = httpx.get(url, timeout=5.0, follow_redirects=True)

        if response.status_code == 200:
            data = response.json()
            tag = data.get("tag_name", "")
            # Strip leading 'v' if present
            version = tag.lstrip("v") if tag else None
            _github_cache[cache_key] = (now, version)
            return version
        elif response.status_code == 404:
            # No releases yet
            _github_cache[cache_key] = (now, None)
            return None
        else:
            logger.warning("GitHub API returned %s when checking for updates", response.status_code)
            return _github_cache.get(cache_key, (0, None))[1]  # Return stale cache if available

    except Exception as exc:
        logger.warning("Failed to check for updates: %s", exc)
        return _github_cache.get(cache_key, (0, None))[1]  # Return stale cache if available


def _compare_versions(current: str, latest: str) -> bool:
    # Simple version comparison - returns True if latest > current
    try:
        def parse_version(v: str) -> tuple[int, ...]:
            # Strip 'v' prefix if present and split on dots
            v = v.lstrip("v")
            parts = v.split(".")
            return tuple(int(p) for p in parts if p.isdigit())

        current_parts = parse_version(current)
        latest_parts = parse_version(latest)

        # Pad shorter version with zeros
        max_len = max(len(current_parts), len(latest_parts))
        current_parts = current_parts + (0,) * (max_len - len(current_parts))
        latest_parts = latest_parts + (0,) * (max_len - len(latest_parts))

        return latest_parts > current_parts
    except (ValueError, AttributeError):
        return False


@router.get("/version", response_model=VersionResponse)
def get_version() -> VersionResponse:
    current = get_current_version()
    latest = _fetch_latest_release()

    update_available = False
    release_url = None

    if latest and current != "unknown":
        update_available = _compare_versions(current, latest)
        if update_available:
            release_url = f"https://github.com/{GITHUB_REPO}/releases/latest"

    return VersionResponse(
        current_version=current,
        latest_version=latest,
        update_available=update_available,
        release_url=release_url,
    )
