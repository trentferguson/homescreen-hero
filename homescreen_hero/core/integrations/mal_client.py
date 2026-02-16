from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

MAL_API_BASE = "https://api.myanimelist.net/v2"
MAL_FIELDS = "id,title,alternative_titles,media_type,num_episodes,start_season"
MAL_PAGE_LIMIT = 100  # max per request

# MAL media_type values
SHOW_TYPES = {"tv", "ova", "ona", "special"}
MOVIE_TYPES = {"movie"}

# Ranking type options
RANKING_OPTIONS = {
    "all": "All",
    "airing": "Airing",
    "upcoming": "Upcoming",
    "bypopularity": "Most Popular",
    "favorite": "Most Favorited",
}

SEASONS = ["winter", "spring", "summer", "fall"]

# URL patterns
_USER_URL_PATTERN = re.compile(
    r"https?://myanimelist\.net/animelist/([^/?#]+)(?:\?.*)?",
    re.IGNORECASE,
)
_RANKING_URL_PATTERN = re.compile(r"mal://ranking/([a-z]+)", re.IGNORECASE)
_SEASON_URL_PATTERN = re.compile(r"mal://season/(\d{4})/([a-z]+)", re.IGNORECASE)

# MAL animelist status values
MAL_STATUSES = {
    "watching": "Watching",
    "completed": "Completed",
    "on_hold": "On Hold",
    "dropped": "Dropped",
    "plan_to_watch": "Plan to Watch",
}

# MAL website uses numeric status values in URLs
_NUMERIC_STATUS_MAP = {
    "1": "watching",
    "2": "completed",
    "3": "on_hold",
    "4": "dropped",
    "6": "plan_to_watch",
}


@dataclass
class MALConfig:
    client_id: str
    base_url: str = MAL_API_BASE


@dataclass
class MALItem:
    mal_id: int
    title: str
    title_en: Optional[str]
    title_ja: Optional[str]
    year: Optional[int]
    media_type: Optional[str]  # tv, movie, ova, ona, special, etc.
    num_episodes: Optional[int]


class MALClient:
    def __init__(self, cfg: MALConfig):
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({
            "X-MAL-Client-ID": cfg.client_id,
        })
        self._last_request_time = 0.0

    def _rate_limit(self):
        # ~1 req/sec to respect MAL's unofficial rate limit
        elapsed = time.time() - self._last_request_time
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        self._last_request_time = time.time()

    def _parse_item(self, node: dict) -> MALItem:
        alt = node.get("alternative_titles") or {}
        start_season = node.get("start_season") or {}
        return MALItem(
            mal_id=node["id"],
            title=node.get("title", ""),
            title_en=alt.get("en") or None,
            title_ja=alt.get("ja") or None,
            year=start_season.get("year"),
            media_type=node.get("media_type"),
            num_episodes=node.get("num_episodes"),
        )

    def ping(self) -> Tuple[bool, Optional[str]]:
        try:
            self._rate_limit()
            resp = self.session.get(
                f"{self.cfg.base_url}/anime/ranking",
                params={"ranking_type": "all", "limit": 1, "fields": "id"},
                timeout=10,
            )
            if resp.status_code == 403:
                return False, "Invalid MAL Client ID"
            if resp.status_code == 429:
                return False, "MAL API rate limited"
            resp.raise_for_status()
            return True, None
        except requests.ConnectionError:
            return False, "Could not connect to MAL API"
        except requests.Timeout:
            return False, "MAL API request timed out"
        except requests.HTTPError as exc:
            return False, f"MAL API returned HTTP {exc.response.status_code}"
        except Exception as exc:
            return False, str(exc)

    def get_user_list(
        self,
        username: str,
        status: Optional[str] = None,
    ) -> List[MALItem]:
        items: List[MALItem] = []
        seen_ids: set[int] = set()
        offset = 0

        while True:
            self._rate_limit()
            params: Dict[str, Any] = {
                "fields": MAL_FIELDS,
                "limit": MAL_PAGE_LIMIT,
                "offset": offset,
                "nsfw": "true",
            }
            if status:
                params["status"] = status

            resp = self.session.get(
                f"{self.cfg.base_url}/users/{username}/animelist",
                params=params,
                timeout=30,
            )
            if resp.status_code == 429:
                raise RuntimeError("MAL API rate limited -- try again later")
            resp.raise_for_status()

            data = resp.json()
            for entry in data.get("data") or []:
                node = entry.get("node") or {}
                mal_id = node.get("id")
                if not mal_id or mal_id in seen_ids:
                    continue
                seen_ids.add(mal_id)
                items.append(self._parse_item(node))

            if not data.get("paging", {}).get("next"):
                break
            offset += MAL_PAGE_LIMIT

        logger.info("Fetched %d anime from MAL user '%s'", len(items), username)
        return items

    def get_ranking_list(
        self,
        ranking_type: str,
        max_items: int = 100,
    ) -> List[MALItem]:
        if ranking_type not in RANKING_OPTIONS:
            raise ValueError(
                f"Unknown ranking type: {ranking_type}. "
                f"Valid: {list(RANKING_OPTIONS.keys())}"
            )

        items: List[MALItem] = []
        seen_ids: set[int] = set()
        offset = 0

        while len(items) < max_items:
            self._rate_limit()
            limit = min(MAL_PAGE_LIMIT, max_items - len(items))
            resp = self.session.get(
                f"{self.cfg.base_url}/anime/ranking",
                params={
                    "ranking_type": ranking_type,
                    "limit": limit,
                    "offset": offset,
                    "fields": MAL_FIELDS,
                    "nsfw": "true",
                },
                timeout=30,
            )
            if resp.status_code == 429:
                raise RuntimeError("MAL API rate limited -- try again later")
            resp.raise_for_status()

            data = resp.json()
            for entry in data.get("data") or []:
                node = entry.get("node") or {}
                mal_id = node.get("id")
                if not mal_id or mal_id in seen_ids:
                    continue
                seen_ids.add(mal_id)
                items.append(self._parse_item(node))

            if not data.get("paging", {}).get("next"):
                break
            offset += limit

        items = items[:max_items]
        logger.info(
            "Fetched %d anime from MAL ranking '%s'", len(items), ranking_type
        )
        return items

    def get_seasonal_list(
        self,
        year: int,
        season: str,
        max_items: int = 100,
    ) -> List[MALItem]:
        if season not in SEASONS:
            raise ValueError(f"Unknown season: {season}. Valid: {SEASONS}")

        items: List[MALItem] = []
        seen_ids: set[int] = set()
        offset = 0

        while len(items) < max_items:
            self._rate_limit()
            limit = min(MAL_PAGE_LIMIT, max_items - len(items))
            resp = self.session.get(
                f"{self.cfg.base_url}/anime/season/{year}/{season}",
                params={
                    "sort": "anime_score",
                    "limit": limit,
                    "offset": offset,
                    "fields": MAL_FIELDS,
                    "nsfw": "true",
                },
                timeout=30,
            )
            if resp.status_code == 429:
                raise RuntimeError("MAL API rate limited -- try again later")
            resp.raise_for_status()

            data = resp.json()
            for entry in data.get("data") or []:
                node = entry.get("node") or {}
                mal_id = node.get("id")
                if not mal_id or mal_id in seen_ids:
                    continue
                seen_ids.add(mal_id)
                items.append(self._parse_item(node))

            if not data.get("paging", {}).get("next"):
                break
            offset += limit

        items = items[:max_items]
        logger.info(
            "Fetched %d anime from MAL season %s %d", len(items), season, year
        )
        return items


# URL parsing helpers

def is_ranking_url(url: str) -> bool:
    return url.strip().startswith("mal://ranking/")


def is_season_url(url: str) -> bool:
    return url.strip().startswith("mal://season/")


def is_browse_url(url: str) -> bool:
    return is_ranking_url(url) or is_season_url(url)


def parse_ranking_url(url: str) -> str:
    # Extract ranking_type from mal://ranking/{type}
    match = _RANKING_URL_PATTERN.match(url.strip())
    if not match:
        raise ValueError(f"Invalid MAL ranking URL: {url}")
    ranking_type = match.group(1)
    if ranking_type not in RANKING_OPTIONS:
        raise ValueError(
            f"Unknown ranking type: {ranking_type}. "
            f"Valid: {list(RANKING_OPTIONS.keys())}"
        )
    return ranking_type


def parse_season_url(url: str) -> Tuple[int, str]:
    # Extract (year, season) from mal://season/{year}/{season}
    match = _SEASON_URL_PATTERN.match(url.strip())
    if not match:
        raise ValueError(f"Invalid MAL season URL: {url}")
    year = int(match.group(1))
    season = match.group(2)
    if season not in SEASONS:
        raise ValueError(f"Unknown season: {season}. Valid: {SEASONS}")
    return year, season


def parse_mal_user_url(url: str) -> Tuple[str, Optional[str]]:
    # Extract (username, status_or_None) from MAL user list URL
    match = _USER_URL_PATTERN.match(url.strip())
    if not match:
        raise ValueError(
            f"Invalid MAL URL: {url}. "
            "Expected: https://myanimelist.net/animelist/username"
        )
    username = match.group(1)

    # Parse status from query string if present
    # MAL website uses numeric values (e.g. ?status=2), API uses text keys
    status = None
    if "?" in url:
        from urllib.parse import parse_qs, urlparse
        qs = parse_qs(urlparse(url).query)
        status_val = qs.get("status", [None])[0]
        if status_val:
            status_val = _NUMERIC_STATUS_MAP.get(status_val, status_val)
            if status_val in MAL_STATUSES:
                status = status_val

    return username, status


def get_mal_client(config) -> Optional[MALClient]:
    if not config.mal:
        return None
    if not config.mal.enabled:
        return None
    client_id = config.mal.client_id
    if not client_id:
        return None
    return MALClient(MALConfig(client_id=client_id))
