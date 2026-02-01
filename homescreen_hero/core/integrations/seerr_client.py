from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import logging
import requests

from ..config.schema import AppConfig, SeerrSettings

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
        # Extract the underlying cause if present
        if "connection refused" in error_str:
            return f"Connection refused. Check that {service_name} is running and the port is correct."
        return f"Could not connect to {service_name}. Check the URL and ensure the server is running."

    return f"Could not connect to {service_name}. Check the URL and network connectivity."


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
        # Health check using the /request endpoint to validate API key has proper permissions.
        # This requires admin-level access, which ensures the API key can actually be used
        # for the features we need (viewing requests, etc.)
        try:
            # Try to fetch just 1 request to validate permissions
            self._request("GET", "/request", params={"take": "1", "skip": "0"})
            logger.debug("Seerr API ping successful at %s", self.cfg.base_url)
            return True, None
        except requests.Timeout:
            return False, "Connection timed out. Check that the URL is correct and the server is responding."
        except requests.ConnectionError as exc:
            return False, _parse_connection_error(exc, "Seerr")
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 401:
                return False, "Unauthorized: invalid Seerr API key"
            if status == 403:
                return False, "Forbidden: API key lacks required permissions. Use the main API key from Settings → General (not a user API key)"
            if status == 404:
                return False, "Server responded but API endpoint not found. Is this an Overseerr/Jellyseerr instance?"
            return False, f"Server returned error {status}"
        except Exception as exc:
            logger.debug("Seerr ping error: %s", exc)
            return False, "Connection failed. Check the URL and ensure the server is running."

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

    def search(self, query: str, page: int = 1) -> Dict[str, Any]:
        # Combined search for movies and TV shows
        # Overseerr requires %20 encoding for spaces (not +)
        from urllib.parse import quote
        try:
            base_url = self._build_url("/search")
            encoded_query = quote(query, safe="")
            url = f"{base_url}?query={encoded_query}&page={page}"

            resp = self.session.get(url, timeout=30.0)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.error("Failed to search Seerr: %s", exc)
            return {"results": [], "totalResults": 0, "totalPages": 0, "page": 1}

    def get_radarr_settings(self) -> List[Dict[str, Any]]:
        # Get list of configured Radarr servers
        try:
            return self._request("GET", "/settings/radarr")
        except Exception as exc:
            logger.error("Failed to get Radarr settings: %s", exc)
            return []

    def get_radarr_profiles(self, radarr_id: int) -> List[Dict[str, Any]]:
        # Get quality profiles for a specific Radarr server
        try:
            return self._request("GET", f"/settings/radarr/{radarr_id}/profiles")
        except Exception as exc:
            logger.error("Failed to get Radarr profiles for %s: %s", radarr_id, exc)
            return []

    def get_sonarr_settings(self) -> List[Dict[str, Any]]:
        # Get list of configured Sonarr servers
        try:
            return self._request("GET", "/settings/sonarr")
        except Exception as exc:
            logger.error("Failed to get Sonarr settings: %s", exc)
            return []

    def get_sonarr_profiles(self, sonarr_id: int) -> List[Dict[str, Any]]:
        # Get quality profiles for a specific Sonarr server
        try:
            return self._request("GET", f"/settings/sonarr/{sonarr_id}/profiles")
        except Exception as exc:
            logger.error("Failed to get Sonarr profiles for %s: %s", sonarr_id, exc)
            return []

    def create_request(
        self,
        media_type: str,
        media_id: int,
        seasons: Optional[List[int]] = None,
        server_id: Optional[int] = None,
        profile_id: Optional[int] = None,
        root_folder: Optional[str] = None,
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        # Create a new media request
        try:
            body: Dict[str, Any] = {
                "mediaType": media_type,
                "mediaId": media_id,
            }
            if media_type == "tv" and seasons is not None:
                body["seasons"] = seasons
            if server_id is not None:
                body["serverId"] = server_id
            if profile_id is not None:
                body["profileId"] = profile_id
            if root_folder:
                body["rootFolder"] = root_folder

            result = self._request("POST", "/request", json=body)
            logger.info("Created Seerr request for %s %s", media_type, media_id)
            return True, None, result
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response else "unknown"
            if status == 409:
                return False, "Media already requested or available", None
            if status == 403:
                return False, "Insufficient permissions to create requests", None
            return False, f"HTTP error: {status}", None
        except Exception as exc:
            logger.error("Failed to create request: %s", exc)
            return False, f"Error creating request: {exc}", None


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
