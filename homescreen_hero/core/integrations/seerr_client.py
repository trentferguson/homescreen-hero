from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import logging
import requests

from ..config.schema import AppConfig, SeerrSettings

logger = logging.getLogger(__name__)


@dataclass
class SeerrConfig:
    api_key: str
    base_url: str = "http://localhost:5055"


class SeerrClient:
    # Seerr uses the X-Api-Key header for authentication
    def __init__(self, cfg: SeerrConfig) -> None:
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({
            "X-Api-Key": cfg.api_key,
            "Content-Type": "application/json",
        })

    def _build_url(self, endpoint: str) -> str:
        base = self.cfg.base_url.rstrip("/")
        # Seerr API is at /api/v1
        return f"{base}/api/v1{endpoint}"

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        timeout: float = 30.0,
    ) -> Any:
        url = self._build_url(endpoint)
        logger.debug("Seerr %s request: %s", method, url)

        try:
            resp = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json,
                timeout=timeout,
            )
            resp.raise_for_status()
        except requests.HTTPError:
            logger.warning(
                "Seerr HTTP error: %s %s -> %s",
                method,
                endpoint,
                resp.status_code,
            )
            raise

        if resp.headers.get("Content-Type", "").startswith("application/json"):
            return resp.json()

        return resp.text

    def ping(self) -> Tuple[bool, Optional[str]]:
        # Health check using the public /status endpoint (no auth required)
        try:
            data = self._request("GET", "/status")
            logger.info("Seerr API ping successful at %s", self.cfg.base_url)
            return True, None
        except requests.Timeout:
            return False, "Timeout while connecting to Seerr"
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Unauthorized: invalid Seerr API key"
            if status == 403:
                return False, "Forbidden: API key lacks required permissions"
            return False, f"HTTP error from Seerr: {status}"
        except Exception as exc:
            return False, f"Error connecting to Seerr: {exc}"

    def get_status(self) -> Dict[str, Any]:
        # Get Seerr server status including version info
        try:
            return self._request("GET", "/status")
        except Exception as exc:
            logger.error("Failed to get Seerr status: %s", exc)
            return {}

    def get_requests(
        self,
        take: int = 5,
        skip: int = 0,
        filter_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        # Get recent media requests from Seerr.
        # Args:
        #     take: Number of requests to return (default: 5)
        #     skip: Number of requests to skip for pagination (default: 0)
        #     filter_status: Optional filter (e.g., "pending", "approved", "available", "processing")
        # Returns:
        #     Dict with pageInfo and results array
        try:
            params: Dict[str, str] = {
                "take": str(take),
                "skip": str(skip),
                "sort": "added",
                "sortDirection": "desc",
            }
            if filter_status:
                params["filter"] = filter_status

            return self._request("GET", "/request", params=params)
        except Exception as exc:
            logger.error("Failed to get Seerr requests: %s", exc)
            return {"pageInfo": {}, "results": []}

    def get_movie(self, tmdb_id: int) -> Dict[str, Any]:
        # Get movie details by TMDB ID
        try:
            return self._request("GET", f"/movie/{tmdb_id}")
        except Exception as exc:
            logger.error("Failed to get movie %s: %s", tmdb_id, exc)
            return {}

    def get_tv(self, tmdb_id: int) -> Dict[str, Any]:
        # Get TV show details by TMDB ID
        try:
            return self._request("GET", f"/tv/{tmdb_id}")
        except Exception as exc:
            logger.error("Failed to get TV show %s: %s", tmdb_id, exc)
            return {}

    def get_movie_ratings(self, tmdb_id: int) -> Dict[str, Any]:
        # Get Rotten Tomatoes ratings for a movie
        try:
            return self._request("GET", f"/movie/{tmdb_id}/ratings")
        except Exception as exc:
            logger.debug("Failed to get movie ratings %s: %s", tmdb_id, exc)
            return {}

    def get_tv_ratings(self, tmdb_id: int) -> Dict[str, Any]:
        # Get Rotten Tomatoes ratings for a TV show
        try:
            return self._request("GET", f"/tv/{tmdb_id}/ratings")
        except Exception as exc:
            logger.debug("Failed to get TV ratings %s: %s", tmdb_id, exc)
            return {}

    def approve_request(self, request_id: int) -> Tuple[bool, Optional[str]]:
        # Approve a pending request by ID
        # Returns (success, error_message)
        try:
            self._request("POST", f"/request/{request_id}/approve")
            logger.info("Approved Seerr request %s", request_id)
            return True, None
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 404:
                return False, f"Request {request_id} not found"
            if status == 401:
                return False, "Unauthorized: invalid API key"
            if status == 403:
                return False, "Forbidden: insufficient permissions to approve requests"
            return False, f"HTTP error: {status}"
        except Exception as exc:
            logger.error("Failed to approve request %s: %s", request_id, exc)
            return False, f"Error approving request: {exc}"

    def decline_request(self, request_id: int) -> Tuple[bool, Optional[str]]:
        # Decline a pending request by ID
        try:
            self._request("POST", f"/request/{request_id}/decline")
            logger.info("Declined Seerr request %s", request_id)
            return True, None
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 404:
                return False, f"Request {request_id} not found"
            if status == 401:
                return False, "Unauthorized: invalid API key"
            if status == 403:
                return False, "Forbidden: insufficient permissions to decline requests"
            return False, f"HTTP error: {status}"
        except Exception as exc:
            logger.error("Failed to decline request %s: %s", request_id, exc)
            return False, f"Error declining request: {exc}"

    def delete_request(self, request_id: int) -> Tuple[bool, Optional[str]]:
        # Delete a request by ID
        try:
            self._request("DELETE", f"/request/{request_id}")
            logger.info("Deleted Seerr request %s", request_id)
            return True, None
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 404:
                return False, f"Request {request_id} not found"
            if status == 401:
                return False, "Unauthorized: invalid API key"
            if status == 403:
                return False, "Forbidden: insufficient permissions to delete requests"
            return False, f"HTTP error: {status}"
        except Exception as exc:
            logger.error("Failed to delete request %s: %s", request_id, exc)
            return False, f"Error deleting request: {exc}"

    def get_request(self, request_id: int) -> Dict[str, Any]:
        # Get a single request by ID
        try:
            return self._request("GET", f"/request/{request_id}")
        except Exception as exc:
            logger.error("Failed to get request %s: %s", request_id, exc)
            return {}


def get_seerr_client(config: AppConfig) -> Optional[SeerrClient]:
    # Create a SeerrClient from AppConfig.
    # Returns None if Seerr is not configured or disabled.
    if config.seerr is None:
        logger.info("Seerr not configured")
        return None

    seerr_cfg: SeerrSettings = config.seerr

    if not seerr_cfg.enabled:
        logger.info("Seerr is disabled in config")
        return None

    if not seerr_cfg.api_key:
        logger.warning("Seerr enabled but api_key is missing")
        return None

    cfg = SeerrConfig(
        api_key=seerr_cfg.api_key,
        base_url=seerr_cfg.base_url,
    )
    return SeerrClient(cfg)
