from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import logging
import requests

from ..config.schema import AppConfig, TautulliSettings

logger = logging.getLogger(__name__)


def _parse_connection_error(exc: Exception, service_name: str) -> str:
    # Parse requests.ConnectionError into user-friendly messages
    error_str = str(exc).lower()

    if "connection refused" in error_str:
        return f"Connection refused. Check that {service_name} is running and the port is correct."
    if "name or service not known" in error_str or "nodename nor servname" in error_str:
        return "Host not found. Check that the hostname or IP address is correct."
    if "no route to host" in error_str:
        return "No route to host. Check the IP address and network connectivity."
    if "network is unreachable" in error_str:
        return "Network unreachable. Check your network connection."
    if "ssl" in error_str or "certificate" in error_str:
        return "SSL/TLS error. Try using http:// instead of https://, or check the certificate."
    if "max retries" in error_str:
        if "connection refused" in error_str:
            return f"Connection refused. Check that {service_name} is running and the port is correct."
        return f"Could not connect to {service_name}. Check the URL and ensure the server is running."

    return f"Could not connect to {service_name}. Check the URL and network connectivity."


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
        # Health check for Tautulli connection using get_activity command
        try:
            self._request("get_activity")
            logger.info("Tautulli API ping successful at %s", self.cfg.base_url)
            return True, None
        except requests.Timeout:
            return False, "Connection timed out. Check that the URL is correct and the server is responding."
        except requests.ConnectionError as exc:
            return False, _parse_connection_error(exc, "Tautulli")
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Unauthorized: invalid Tautulli API key"
            if status == 404:
                return False, "Server responded but API not found. Is this a Tautulli instance?"
            return False, f"Server returned error {status}"
        except ValueError as exc:
            # Tautulli API returned an error response
            msg = str(exc)
            if "invalid api key" in msg.lower():
                return False, "Invalid API key. Check your Tautulli API key."
            return False, msg
        except Exception as exc:
            logger.debug("Tautulli ping error: %s", exc)
            return False, "Connection failed. Check the URL and ensure the server is running."

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

    def get_collection_stats(self, rating_key: int, query_days: int = 30) -> Dict[str, Any]:
        """
        Get watch statistics for a specific collection by rating_key.

        Args:
            rating_key: Plex rating key for the item
            query_days: Number of days to query (default: 30)

        Returns dict with total_plays, total_duration, etc.
        """
        try:
            params = {
                "rating_key": str(rating_key),
                "query_days": str(query_days),
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

    def get_user_watch_time_stats(
        self,
        query_days: int = 30,
        grouping: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Get watch time statistics for all users.

        Args:
            query_days: Number of days to query (default: 30)
            grouping: Grouping type (0 = None, default)

        Returns:
            List of user stats with username, total_plays, total_time (seconds), etc.
        """
        try:
            params = {
                "query_days": str(query_days),
                "grouping": str(grouping),
            }
            logger.info(f"Requesting user watch time stats with params: {params}")
            data = self._request("get_user_watch_time_stats", params=params)

            logger.info(f"Received user stats raw data: {data}")
            logger.info(f"Received user stats data type: {type(data)}, length: {len(data) if isinstance(data, list) else 'N/A'}")

            if not isinstance(data, list):
                logger.warning(f"Unexpected response format for user watch time stats: {type(data)}")
                # If it's a dict with a 'data' key, try to extract it
                if isinstance(data, dict) and "data" in data:
                    logger.info("Extracting data from dict wrapper")
                    data = data["data"]
                    if not isinstance(data, list):
                        return []
                else:
                    return []

            if len(data) > 0:
                logger.info(f"First user entry: {data[0]}")

            return data
        except Exception as exc:
            logger.error("Failed to get user watch time stats: %s", exc, exc_info=True)
            return []

    def get_users_table(self, length: int = 25, order_column: str = "total_plays") -> List[Dict[str, Any]]:
        """
        Get users table with watch statistics.
        Alternative method that uses get_users_table instead of get_user_watch_time_stats.

        Args:
            length: Number of users to return (default: 25)
            order_column: Column to order by (default: total_plays)

        Returns:
            List of user data with stats
        """
        try:
            params = {
                "length": str(length),
                "order_column": order_column,
                "order_dir": "desc",
            }
            logger.info(f"Requesting users table with params: {params}")
            data = self._request("get_users_table", params=params)

            logger.info(f"Received users table raw data type: {type(data)}")

            # get_users_table returns a dict with 'data' key containing the list
            if isinstance(data, dict):
                if "data" in data:
                    users_list = data["data"]
                    logger.info(f"Extracted {len(users_list) if isinstance(users_list, list) else 0} users from table")
                    if users_list and len(users_list) > 0:
                        logger.info(f"First user from table: {users_list[0]}")
                    return users_list if isinstance(users_list, list) else []
                else:
                    logger.warning(f"get_users_table returned dict without 'data' key: {data.keys()}")
                    return []
            elif isinstance(data, list):
                return data
            else:
                logger.warning(f"Unexpected response type from get_users_table: {type(data)}")
                return []

        except Exception as exc:
            logger.error("Failed to get users table: %s", exc, exc_info=True)
            return []

    def get_home_stats(self, time_range: int = 30, stats_type: str = "plays"):
        """
        Get home statistics including user watch data.

        Args:
            time_range: Number of days to query (default: 30)
            stats_type: Type of stats (plays, duration, etc.)

        Returns:
            Dict with various statistics including top users, or list of stats
        """
        try:
            params = {
                "time_range": str(time_range),
                "stats_type": stats_type,
            }
            logger.info(f"Requesting home stats with params: {params}")
            data = self._request("get_home_stats", params=params)

            logger.info(f"Received home stats data type: {type(data)}")
            if isinstance(data, dict):
                logger.info(f"Home stats keys: {list(data.keys()) if hasattr(data, 'keys') else 'N/A'}")
            elif isinstance(data, list):
                logger.info(f"Home stats is a list with {len(data)} items")
                if data and len(data) > 0:
                    logger.info(f"First home stats item: {data[0]}")

            # Return data as-is, whether it's a dict or list
            return data

        except Exception as exc:
            logger.error("Failed to get home stats: %s", exc, exc_info=True)
            return {}

    def get_plays_by_date(self, time_range: int = 30, y_axis: str = "plays") -> Any:
        """
        Get play counts grouped by date for graphing.

        Args:
            time_range: Number of days to query (default: 30)
            y_axis: What to measure - "plays" or "duration"

        Returns:
            Dict with categories (dates) and series (play data per media type)
        """
        try:
            params = {
                "time_range": str(time_range),
                "y_axis": y_axis,
            }
            logger.debug(f"Requesting plays by date with params: {params}")
            return self._request("get_plays_by_date", params=params)
        except Exception as exc:
            logger.error("Failed to get plays by date: %s", exc, exc_info=True)
            return {}

    def get_plays_by_hourofday(self, time_range: int = 30, y_axis: str = "plays") -> Any:
        """
        Get play counts grouped by hour of day for graphing.

        Args:
            time_range: Number of days to query (default: 30)
            y_axis: What to measure - "plays" or "duration"

        Returns:
            Dict with categories (hours 00-23) and series (play data per media type)
        """
        try:
            params = {
                "time_range": str(time_range),
                "y_axis": y_axis,
            }
            logger.debug(f"Requesting plays by hour of day with params: {params}")
            return self._request("get_plays_by_hourofday", params=params)
        except Exception as exc:
            logger.error("Failed to get plays by hour of day: %s", exc, exc_info=True)
            return {}

    def get_stream_type_by_top_10_users(self, time_range: int = 30) -> Any:
        """
        Get stream type data by top 10 users.

        Args:
            time_range: Number of days to query (default: 30)

        Returns:
            Dict with categories (usernames) and series (stream type counts)
        """
        try:
            params = {
                "time_range": str(time_range),
            }
            logger.debug(f"Requesting stream type by top 10 users with params: {params}")
            return self._request("get_stream_type_by_top_10_users", params=params)
        except Exception as exc:
            logger.error("Failed to get stream type by top 10 users: %s", exc, exc_info=True)
            return {}

    def get_plays_by_stream_type(self, time_range: int = 30, y_axis: str = "plays") -> Any:
        """
        Get play counts grouped by stream type (Direct Play, Direct Stream, Transcode) by date.

        Args:
            time_range: Number of days to query (default: 30)
            y_axis: What to measure - "plays" or "duration"

        Returns:
            Dict with categories (dates) and series (stream type data including max concurrent)
        """
        try:
            params = {
                "time_range": str(time_range),
                "y_axis": y_axis,
            }
            logger.debug(f"Requesting plays by stream type with params: {params}")
            return self._request("get_plays_by_stream_type", params=params)
        except Exception as exc:
            logger.error("Failed to get plays by stream type: %s", exc, exc_info=True)
            return {}

    def get_history(
        self,
        length: int = 1000,
        start: int = 0,
        order_column: str = "date",
        order_dir: str = "desc",
    ) -> List[Dict[str, Any]]:
        """
        Get watch history with detailed timestamps for calculating concurrent viewers.

        Args:
            length: Number of history items to return (default: 1000)
            start: Starting index (default: 0)
            order_column: Column to order by (default: date)
            order_dir: Order direction (default: desc)

        Returns:
            List of history entries with start/stop times
        """
        try:
            params = {
                "length": str(length),
                "start": str(start),
                "order_column": order_column,
                "order_dir": order_dir,
            }
            logger.debug(f"Requesting history with params: {params}")
            data = self._request("get_history", params=params)

            if isinstance(data, dict) and "data" in data:
                return data["data"]
            return data if isinstance(data, list) else []
        except Exception as exc:
            logger.error("Failed to get history: %s", exc, exc_info=True)
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
