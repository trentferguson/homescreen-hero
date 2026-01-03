from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import logging
import requests
import re

from ..config.schema import AppConfig, MDBListSettings

logger = logging.getLogger(__name__)


@dataclass
class MDBListConfig:
    api_key: str
    base_url: str = "https://api.mdblist.com"


# Data class representing a movie from MDBList
@dataclass
class MDBListMovie:
    title: str
    year: Optional[int]
    imdb_id: Optional[str]
    tmdb_id: Optional[int]
    trakt_id: Optional[int]
    mdblist_id: Optional[str]


class MDBListClient:
    def __init__(self, cfg: MDBListConfig) -> None:
        self.cfg = cfg
        self.session = requests.Session()

        # User agent header
        headers: Dict[str, str] = {
            "User-Agent": "HomeScreenHero/1.0",
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

        # Add API key to params
        if params is None:
            params = {}
        params["apikey"] = self.cfg.api_key

        logger.debug("MDBList request: %s %s", method, url)

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
                "MDBList HTTP error: %s %s -> %s",
                method,
                url,
                resp.status_code,
            )
            raise

        if resp.headers.get("Content-Type", "").startswith("application/json"):
            return resp.json()

        return resp.text

    # Test MDBList API connectivity and validate API key
    def ping(self) -> Tuple[bool, Optional[str]]:
        try:
            data = self._request("GET", "/user")

            # Check rate limit info from headers
            limit = self.session.headers.get("X-RateLimit-Limit", "unknown")
            remaining = self.session.headers.get("X-RateLimit-Remaining", "unknown")

            logger.info("MDBList API ping successful at %s", self.cfg.base_url)
            return True, f"API key valid. Rate limit: {remaining}/{limit} remaining"
        except requests.Timeout:
            return False, "Timeout while connecting to MDBList"
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Unauthorized: invalid MDBList API key"
            elif status == 429:
                return False, "Rate limit exceeded"
            return False, f"HTTP error from MDBList: {status}"
        except Exception as exc:
            return False, f"Error connecting to MDBList: {exc}"

    def get_list_items(self, list_url: str) -> List[MDBListMovie]:
        # Fetch movies from an MDBList URL
        #Args:
        #    list_url: MDBList URL (e.g., https://mdblist.com/lists/username/listname)

        # Returns:
        #    List of MDBListMovie objects


        # Parse URL to extract username and listname
        username, listname = self._parse_list_url(list_url)

        if not (username and listname):
            raise ValueError(f"Invalid MDBList URL: {list_url}")

        # Fetch all items with pagination
        all_movies: List[MDBListMovie] = []
        offset = 0
        limit = 100  # Max items per request

        while True:
            api_path = f"/lists/{username}/{listname}/items"
            params = {
                "limit": limit,
                "offset": offset,
            }

            data = self._request("GET", api_path, params=params)
            movies_data = data.get("movies", [])

            # Convert to MDBListMovie objects
            for movie in movies_data:
                all_movies.append(self._parse_movie(movie))

            # Check if there are more items
            # MDBList returns X-Has-More header, but we can also check if we got fewer than limit
            if len(movies_data) < limit:
                break

            offset += limit

        return all_movies

    # Parse movie data from API response
    @staticmethod
    def _parse_movie(movie_data: Dict[str, Any]) -> MDBListMovie:
        ids = movie_data.get("ids", {})
        return MDBListMovie(
            title=movie_data.get("title", ""),
            year=movie_data.get("year"),
            imdb_id=ids.get("imdb"),
            tmdb_id=ids.get("tmdb"),
            trakt_id=ids.get("trakt"),
            mdblist_id=ids.get("mdblist"),
        )

    # Extract username and listname from MDBList URL
    @staticmethod
    def _parse_list_url(url: str) -> Tuple[Optional[str], Optional[str]]:
        # Pattern: /lists/username/listname
        match = re.search(r"/lists/([^/]+)/([^/?#]+)", url)
        if match:
            return match.group(1), match.group(2)

        return None, None


def get_mdblist_client(config: AppConfig) -> Optional[MDBListClient]:
    if config.mdblist is None:
        logger.info("MDBList not configured")
        return None

    mdblist_cfg: MDBListSettings = config.mdblist

    if not mdblist_cfg.enabled:
        logger.info("MDBList is disabled in config")
        return None

    if not mdblist_cfg.api_key:
        logger.warning("MDBList enabled but api_key is missing")
        return None

    cfg = MDBListConfig(
        api_key=mdblist_cfg.api_key,
        base_url=mdblist_cfg.base_url,
    )
    return MDBListClient(cfg)
