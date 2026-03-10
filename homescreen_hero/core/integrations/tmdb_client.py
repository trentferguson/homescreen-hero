from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import logging
import requests
import re

from ..config.schema import AppConfig, TMDbSettings

logger = logging.getLogger(__name__)


@dataclass
class TMDbConfig:
    api_key: str
    base_url: str = "https://api.themoviedb.org/3"


@dataclass
class TMDbListItem:
    title: str
    year: Optional[int]
    tmdb_id: int
    media_type: Optional[str]  # "movie" or "tv"


class TMDbClient:
    def __init__(self, cfg: TMDbConfig) -> None:
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "HomeScreenHero/1.0",
        })

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

        if params is None:
            params = {}
        params["api_key"] = self.cfg.api_key

        logger.debug("TMDb request: %s %s", method, url)

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
                "TMDb HTTP error: %s %s -> %s",
                method,
                url,
                resp.status_code,
            )
            raise

        if resp.headers.get("Content-Type", "").startswith("application/json"):
            return resp.json()

        return resp.text

    def ping(self) -> Tuple[bool, Optional[str]]:
        if not self.cfg.api_key:
            return False, "No API key configured"

        try:
            self._request("GET", "/configuration")
            logger.debug("TMDb API ping successful at %s", self.cfg.base_url)
            return True, "API key valid"
        except requests.Timeout:
            return False, "Connection timed out. Check your network connection."
        except requests.ConnectionError:
            return False, "Could not connect to TMDb. Check your network connection."
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Invalid API key. Check your TMDb API key."
            if status == 429:
                return False, "Rate limit exceeded. Try again later."
            return False, f"TMDb API returned error {status}"
        except Exception as exc:
            logger.debug("TMDb ping error: %s", exc)
            return False, "Connection failed. Check your network connection."

    def get_list_items(self, list_url: str) -> List[TMDbListItem]:
        list_id = self._parse_list_url(list_url)
        if not list_id:
            raise ValueError(f"Invalid TMDb list URL: {list_url}")

        all_items: List[TMDbListItem] = []
        page = 1

        while True:
            data = self._request(
                "GET",
                f"/list/{list_id}",
                params={"page": page, "language": "en-US"},
            )

            items = data.get("items", [])
            for item in items:
                parsed = self._parse_item(item)
                if parsed:
                    all_items.append(parsed)

            # Check for more pages
            total_pages = data.get("total_pages", 1)
            if page >= total_pages:
                break
            page += 1

        return all_items

    def get_movie_details(self, tmdb_id: int) -> dict:
        # Returns full movie details including belongs_to_collection
        return self._request("GET", f"/movie/{tmdb_id}")

    def get_collection_details(self, collection_id: int) -> dict:
        # Returns collection with ordered parts list
        return self._request("GET", f"/collection/{collection_id}")

    def search_collections(self, query: str) -> List[dict]:
        data = self._request(
            "GET",
            "/search/collection",
            params={"query": query, "language": "en-US"},
        )
        return data.get("results", [])

    @staticmethod
    def _parse_item(item_data: Dict[str, Any]) -> Optional[TMDbListItem]:
        tmdb_id = item_data.get("id")
        if not tmdb_id:
            return None

        media_type = item_data.get("media_type")

        # Movies use "title", TV shows use "name"
        title = item_data.get("title") or item_data.get("name") or ""
        if not title:
            return None

        # Extract year from release_date (movies) or first_air_date (tv)
        year = None
        date_str = item_data.get("release_date") or item_data.get("first_air_date") or ""
        if date_str and len(date_str) >= 4:
            try:
                year = int(date_str[:4])
            except ValueError:
                pass

        return TMDbListItem(
            title=title,
            year=year,
            tmdb_id=tmdb_id,
            media_type=media_type,
        )

    @staticmethod
    def _parse_list_url(url: str) -> Optional[str]:
        # Handles: https://www.themoviedb.org/list/123456
        match = re.search(r"/list/(\d+)", url)
        if match:
            return match.group(1)
        # Also accept bare list IDs
        if url.strip().isdigit():
            return url.strip()
        return None


def get_tmdb_client(config: AppConfig) -> Optional[TMDbClient]:
    if config.tmdb is None:
        logger.info("TMDb not configured")
        return None

    tmdb_cfg: TMDbSettings = config.tmdb

    if not tmdb_cfg.enabled:
        logger.info("TMDb is disabled in config")
        return None

    if not tmdb_cfg.api_key:
        logger.warning("TMDb enabled but api_key is missing")
        return None

    cfg = TMDbConfig(
        api_key=tmdb_cfg.api_key,
        base_url=tmdb_cfg.base_url,
    )
    return TMDbClient(cfg)
