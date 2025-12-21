from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import logging
import requests
import re

from ..config.schema import AppConfig, TraktSettings

logger = logging.getLogger(__name__)


@dataclass
class TraktConfig:
    client_id: str
    base_url: str = "https://api.trakt.tv"


class TraktClient:
    def __init__(self, cfg: TraktConfig) -> None:
        self.cfg = cfg
        self.session = requests.Session()

        # Required headers for all Trakt API requests
        headers: Dict[str, str] = {
            "trakt-api-version": "2",
            "Content-Type": "application/json",
            "trakt-api-key": self.cfg.client_id,
        }

        self.session.headers.update(headers)

    def _build_url(self, path: str) -> str:
        base = self.cfg.base_url.rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 10.0,
    ) -> Any:
        url = self._build_url(path)
        logger.debug("Trakt request: %s %s", method, url)

        resp = self.session.request(
            method=method,
            url=url,
            params=params,
            timeout=timeout,
        )

        try:
            resp.raise_for_status()
        except requests.HTTPError:
            logger.warning(
                "Trakt HTTP error: %s %s -> %s",
                method,
                url,
                resp.status_code,
            )
            raise

        if resp.headers.get("Content-Type", "").startswith("application/json"):
            return resp.json()

        return resp.text


    def ping(self) -> Tuple[bool, Optional[str]]:
        # Public endpoint used for health check
        try:
            self._request("GET", "/movies/popular", params={"page": 1, "limit": 1})
            logger.info("Trakt API ping successful at %s", self.cfg.base_url)
            return True, None
        except requests.Timeout:
            return False, "Timeout while connecting to Trakt"
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Unauthorized: invalid Trakt client_id"
            return False, f"HTTP error from Trakt: {status}"
        except Exception as exc:
            return False, f"Error connecting to Trakt: {exc}"

    def get_popular_movies(self, limit: int = 10) -> Any:
        return self._request(
            "GET",
            "/movies/popular",
            params={"page": 1, "limit": limit},
        )

    def get_trending_movies(self, limit: int = 10) -> Any:
        return self._request(
            "GET",
            "/movies/trending",
            params={"page": 1, "limit": limit},
        )

    def get_anticipated_movies(self, limit: int = 10) -> Any:
        return self._request(
            "GET",
            "/movies/anticipated",
            params={"page": 1, "limit": limit},
        )

    def get_popular_shows(self, limit: int = 10) -> Any:
        return self._request(
            "GET",
            "/shows/popular",
            params={"page": 1, "limit": limit},
        )
    
    def get_list_items_from_url(self, url: str) -> Any:
        # Expects URL: https://trakt.tv/users/<username>/lists/<slug>
        # Convert to: /users/<username>/lists/<slug>/items/movies
        pattern = r"/users/(?P<user>[^/]+)/lists/(?P<slug>[^/?#]+)"
        match = re.search(pattern, url)
        if not match:
            raise ValueError(f"Unsupported Trakt list URL format: {url}")

        user = match.group("user")
        slug = match.group("slug")

        api_path = f"/users/{user}/lists/{slug}/items/movies"
        params = {"extended": "full"}
        return self._request("GET", api_path, params=params)


def get_trakt_client(config: AppConfig) -> Optional[TraktClient]:
    if config.trakt is None:
        logger.info("Trakt not configured")
        return None

    trakt_cfg: TraktSettings = config.trakt

    if not trakt_cfg.enabled:
        logger.info("Trakt is disabled in config")
        return None

    if not trakt_cfg.client_id:
        logger.warning("Trakt enabled but client_id is missing")
        return None

    cfg = TraktConfig(
        client_id=trakt_cfg.client_id,
        base_url=trakt_cfg.base_url,
    )
    return TraktClient(cfg)
