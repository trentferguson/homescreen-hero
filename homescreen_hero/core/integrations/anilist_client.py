from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote

import requests

logger = logging.getLogger(__name__)

ANILIST_GRAPHQL_URL = "https://graphql.anilist.co"

# GraphQL query to fetch a user's full anime list
USER_LIST_QUERY = """
query ($userName: String!, $type: MediaType!) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      name
      isCustomList
      entries {
        media {
          id
          idMal
          type
          format
          title {
            romaji
            english
            native
          }
          seasonYear
          startDate {
            year
          }
          episodes
          synonyms
        }
      }
    }
  }
}
"""

# Lightweight query to fetch list names only (no entries)
USER_LISTS_QUERY = """
query ($userName: String!, $type: MediaType!) {
  MediaListCollection(userName: $userName, type: $type) {
    lists {
      name
      isCustomList
    }
  }
}
"""

# Lightweight query for health check
PING_QUERY = """
query {
  Viewer {
    id
  }
}
"""

# URL pattern: https://anilist.co/user/{username}/animelist or /animelist/{listname}
_URL_PATTERN = re.compile(
    r"https?://anilist\.co/user/([^/]+)/animelist(?:/(.+))?",
    re.IGNORECASE,
)


@dataclass
class AniListConfig:
    base_url: str = ANILIST_GRAPHQL_URL


@dataclass
class AniListItem:
    anilist_id: int
    mal_id: Optional[int]
    title_english: Optional[str]
    title_romaji: Optional[str]
    year: Optional[int]
    media_format: Optional[str]  # TV, MOVIE, OVA, ONA, SPECIAL, etc.
    episodes: Optional[int]


class AniListClient:
    def __init__(self, cfg: AniListConfig):
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def ping(self) -> Tuple[bool, Optional[str]]:
        # Test the GraphQL endpoint with a simple query
        # The Viewer query will return null without auth, but a 200 means the API is reachable
        try:
            resp = self.session.post(
                self.cfg.base_url,
                json={"query": "{ SiteStatistics { anime { nodes { count } } } }"},
                timeout=10,
            )
            if resp.status_code == 429:
                return False, "AniList API rate limited"
            resp.raise_for_status()
            return True, None
        except requests.ConnectionError:
            return False, "Could not connect to AniList API"
        except requests.Timeout:
            return False, "AniList API request timed out"
        except requests.HTTPError as exc:
            return False, f"AniList API returned HTTP {exc.response.status_code}"
        except Exception as exc:
            return False, str(exc)

    def get_user_lists(self, username: str) -> List[Dict[str, Any]]:
        # Fetch just the list names for a user (no entries — fast)
        resp = self.session.post(
            self.cfg.base_url,
            json={
                "query": USER_LISTS_QUERY,
                "variables": {"userName": username, "type": "ANIME"},
            },
            timeout=15,
        )

        if resp.status_code == 429:
            raise RuntimeError("AniList API rate limited — try again later")
        resp.raise_for_status()

        data = resp.json()
        if "errors" in data:
            error_msg = data["errors"][0].get("message", "Unknown GraphQL error")
            raise RuntimeError(f"AniList API error: {error_msg}")

        collection = data.get("data", {}).get("MediaListCollection")
        if not collection:
            return []

        results: List[Dict[str, Any]] = []
        for lst in collection.get("lists") or []:
            name = lst.get("name", "")
            is_custom = lst.get("isCustomList", False)
            # Default lists use lowercase in the URL; custom lists use the name as-is
            value = name if is_custom else name.lower()
            results.append({
                "value": value,
                "label": name,
                "is_custom": is_custom,
            })

        return results

    def get_user_list(
        self,
        username: str,
        list_name: Optional[str] = None,
    ) -> List[AniListItem]:
        # Fetch a user's anime list from AniList
        resp = self.session.post(
            self.cfg.base_url,
            json={
                "query": USER_LIST_QUERY,
                "variables": {"userName": username, "type": "ANIME"},
            },
            timeout=30,
        )

        if resp.status_code == 429:
            raise RuntimeError("AniList API rate limited — try again later")
        resp.raise_for_status()

        data = resp.json()
        if "errors" in data:
            error_msg = data["errors"][0].get("message", "Unknown GraphQL error")
            raise RuntimeError(f"AniList API error: {error_msg}")

        collection = data.get("data", {}).get("MediaListCollection")
        if not collection:
            logger.warning("No anime list found for user '%s'", username)
            return []

        lists = collection.get("lists") or []

        # Filter to specific list if requested (case-insensitive)
        if list_name:
            decoded_name = unquote(list_name).lower()
            lists = [lst for lst in lists if (lst.get("name") or "").lower() == decoded_name]
            if not lists:
                logger.warning(
                    "List '%s' not found for user '%s'. Available lists: %s",
                    decoded_name,
                    username,
                    [lst.get("name") for lst in collection.get("lists", [])],
                )
                return []

        # Flatten entries from all matching lists
        items: List[AniListItem] = []
        seen_ids: set[int] = set()

        for lst in lists:
            for entry in lst.get("entries") or []:
                media = entry.get("media") or {}
                anilist_id = media.get("id")
                if not anilist_id or anilist_id in seen_ids:
                    continue
                seen_ids.add(anilist_id)

                title = media.get("title") or {}
                year = media.get("seasonYear") or (media.get("startDate") or {}).get("year")

                items.append(AniListItem(
                    anilist_id=anilist_id,
                    mal_id=media.get("idMal"),
                    title_english=title.get("english"),
                    title_romaji=title.get("romaji"),
                    year=year,
                    media_format=media.get("format"),
                    episodes=media.get("episodes"),
                ))

        logger.info("Fetched %d anime from AniList user '%s'", len(items), username)
        return items


def parse_anilist_url(url: str) -> Tuple[str, Optional[str]]:
    # Extract username and optional list name from an AniList URL
    # Returns (username, list_name) where list_name may be None
    match = _URL_PATTERN.match(url.strip())
    if not match:
        raise ValueError(
            f"Invalid AniList URL: {url}. "
            "Expected format: https://anilist.co/user/username/animelist or "
            "https://anilist.co/user/username/animelist/listname"
        )
    username = match.group(1)
    list_name = match.group(2)
    if list_name:
        list_name = unquote(list_name)
    return username, list_name


def get_anilist_client(config) -> Optional[AniListClient]:
    # Factory function: returns None if AniList is not configured
    if not config.anilist:
        return None
    return AniListClient(AniListConfig())
