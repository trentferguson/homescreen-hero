from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import logging
import requests

from ..config.schema import AppConfig, TautulliSettings

logger = logging.getLogger(__name__)


@dataclass
class TautulliConfig:
    api_key: str
    base_url: str = "http://localhost:8181"


class TautulliClient:
    def __init__(self, cfg: TautulliConfig) -> None:
        self.cfg = cfg
        self.session = requests.Session()

        # Tautulli uses API key in URL params, not headers
        # No special headers needed

    def _build_url(self, cmd: str, params: Optional[Dict[str, Any]] = None) -> str:
        """Build Tautulli API URL with command and parameters"""
        base = self.cfg.base_url.rstrip("/")
        url = f"{base}/api/v2"

        # Start with API key and command
        query_params = {
            "apikey": self.cfg.api_key,
            "cmd": cmd,
        }

        # Add any additional parameters
        if params:
            query_params.update(params)

        # Build query string
        query_string = "&".join(f"{k}={v}" for k, v in query_params.items())
        return f"{url}?{query_string}"

    def _request(
        self,
        cmd: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0,
    ) -> Any:
        """Make a request to Tautulli API"""
        url = self._build_url(cmd, params)
        logger.debug("Tautulli request: %s", url.replace(self.cfg.api_key, "***"))

        try:
            resp = self.session.get(url, timeout=timeout)
            resp.raise_for_status()
        except requests.HTTPError:
            logger.warning(
                "Tautulli HTTP error: %s -> %s",
                cmd,
                resp.status_code,
            )
            raise

        if resp.headers.get("Content-Type", "").startswith("application/json"):
            data = resp.json()

            # Tautulli wraps responses in {"response": {"result": "success", "data": ...}}
            if isinstance(data, dict) and "response" in data:
                response = data["response"]
                if response.get("result") == "success":
                    return response.get("data")
                else:
                    error_msg = response.get("message", "Unknown error")
                    raise ValueError(f"Tautulli API error: {error_msg}")

            return data

        return resp.text

    def ping(self) -> Tuple[bool, Optional[str]]:
        """
        Health check for Tautulli connection.
        Uses get_activity command as a simple test.
        """
        try:
            self._request("get_activity")
            logger.info("Tautulli API ping successful at %s", self.cfg.base_url)
            return True, None
        except requests.Timeout:
            return False, "Timeout while connecting to Tautulli"
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Unauthorized: invalid Tautulli API key"
            return False, f"HTTP error from Tautulli: {status}"
        except ValueError as exc:
            return False, str(exc)
        except Exception as exc:
            return False, f"Error connecting to Tautulli: {exc}"

    def get_libraries(self) -> List[Dict[str, Any]]:
        """
        Get list of Plex libraries from Tautulli.
        Returns list of library info including section_id.
        """
        try:
            data = self._request("get_libraries_table")
            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []
        except Exception as exc:
            logger.error("Failed to get libraries from Tautulli: %s", exc)
            return []

    def get_library_collections(self, section_id: int) -> List[Dict[str, Any]]:
        """
        Get collections in a specific library.
        Returns list of collections with rating_key and title.
        """
        try:
            params = {
                "section_id": str(section_id),
                "section_type": "collections",
            }
            data = self._request("get_library_media_info", params=params)

            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []
        except Exception as exc:
            logger.error("Failed to get collections for section %s: %s", section_id, exc)
            return []

    def get_collection_stats(self, rating_key: int) -> Dict[str, Any]:
        """
        Get watch statistics for a specific collection by rating_key.
        Returns dict with total_plays, total_duration, etc.
        """
        try:
            params = {
                "rating_key": str(rating_key),
            }
            data = self._request("get_item_watch_time_stats", params=params)

            if not isinstance(data, list) or len(data) == 0:
                logger.warning("No stats found for rating_key %s", rating_key)
                return {
                    "total_plays": 0,
                    "total_duration": None,
                }

            # Tautulli returns list, first item has the stats
            stats = data[0] if isinstance(data, list) else data

            return {
                "total_plays": int(stats.get("total_plays", 0)),
                "total_duration": int(stats.get("total_duration", 0)) if stats.get("total_duration") else None,
                "total_time": stats.get("total_time"),
            }
        except Exception as exc:
            logger.error("Failed to get stats for rating_key %s: %s", rating_key, exc)
            return {
                "total_plays": 0,
                "total_duration": None,
            }

    def get_collection_history(
        self,
        rating_key: int,
        length: int = 25,
    ) -> List[Dict[str, Any]]:
        """
        Get play history for a specific collection.
        Returns list of recent play events.
        """
        try:
            params = {
                "rating_key": str(rating_key),
                "length": str(length),
            }
            data = self._request("get_history", params=params)

            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []
        except Exception as exc:
            logger.error("Failed to get history for rating_key %s: %s", rating_key, exc)
            return []


def get_tautulli_client(config: AppConfig) -> Optional[TautulliClient]:
    """
    Factory function to create a TautulliClient from app config.
    Returns None if Tautulli is not configured or disabled.
    """
    if config.tautulli is None:
        logger.info("Tautulli not configured")
        return None

    tautulli_cfg: TautulliSettings = config.tautulli

    if not tautulli_cfg.enabled:
        logger.info("Tautulli is disabled in config")
        return None

    if not tautulli_cfg.api_key:
        logger.warning("Tautulli enabled but api_key is missing")
        return None

    cfg = TautulliConfig(
        api_key=tautulli_cfg.api_key,
        base_url=tautulli_cfg.base_url,
    )
    return TautulliClient(cfg)
