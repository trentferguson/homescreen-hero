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
