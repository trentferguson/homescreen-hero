from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import requests
from cachetools import TTLCache
from plexapi.myplex import MyPlexAccount

logger = logging.getLogger(__name__)

# Pending PIN cache (5 min TTL, max 100 concurrent logins)
_pending_pins: TTLCache = TTLCache(maxsize=100, ttl=300)

PLEX_PINS_URL = "https://plex.tv/api/v2/pins"

# Persistent client identifier — generated once per process, but could be
# stored in DB for cross-restart consistency in the future.
_client_id: str | None = None


def _get_client_id() -> str:
    global _client_id
    if _client_id is None:
        _client_id = str(uuid.uuid4())
    return _client_id


def _plex_headers() -> Dict[str, str]:
    return {
        "Accept": "application/json",
        "X-Plex-Client-Identifier": _get_client_id(),
        "X-Plex-Product": "Homescreen Hero",
        "X-Plex-Version": "1.0",
        "X-Plex-Platform": "Web",
        "X-Plex-Device": "Browser",
        "X-Plex-Device-Name": "Homescreen Hero",
    }


def create_plex_pin(forward_url: str) -> Dict[str, Any]:
    # Create a Plex OAuth PIN and return the pin_id + OAuth URL.
    resp = requests.post(
        PLEX_PINS_URL,
        headers=_plex_headers(),
        params={"strong": "true"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    pin_id = data["id"]
    code = data["code"]

    _pending_pins[pin_id] = code

    headers = _plex_headers()
    oauth_params = {
        "clientID": headers["X-Plex-Client-Identifier"],
        "code": code,
        "forwardUrl": forward_url,
        "context[device][product]": headers["X-Plex-Product"],
        "context[device][version]": headers["X-Plex-Version"],
        "context[device][platform]": headers["X-Plex-Platform"],
        "context[device][device]": headers["X-Plex-Device"],
    }
    oauth_url = f"https://app.plex.tv/auth/#!?{urlencode(oauth_params)}"

    return {"pin_id": pin_id, "oauth_url": oauth_url}


def check_plex_pin(pin_id: int) -> Optional[str]:
    # Check if a PIN has been claimed. Returns the authToken if yes, None if pending.
    code = _pending_pins.get(pin_id)

    headers = _plex_headers()
    params = {}
    if code:
        params["code"] = code

    resp = requests.get(
        f"{PLEX_PINS_URL}/{pin_id}",
        headers=headers,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    auth_token = data.get("authToken")
    if auth_token:
        _pending_pins.pop(pin_id, None)
        return auth_token
    return None


def get_plex_user_info(plex_token: str) -> Dict[str, Any]:
    # Get Plex account info from a user's auth token.
    account = MyPlexAccount(token=plex_token)
    return {
        "plex_id": account.id,
        "username": account.title or account.username,
        "email": account.email,
        "thumb": account.thumb,
    }


def validate_server_access(
    user_plex_token: str,
    admin_plex_token: str,
    server_machine_id: str,
) -> Dict[str, Any]:
    # Check if a Plex user has access to the configured server.
    # Returns user info dict with "allowed" and "is_owner" flags.
    user_account = MyPlexAccount(token=user_plex_token)
    user_info = {
        "plex_id": user_account.id,
        "username": user_account.title or user_account.username,
        "email": user_account.email,
        "thumb": user_account.thumb,
    }

    admin_account = MyPlexAccount(token=admin_plex_token)

    # Server owner check
    if user_account.id == admin_account.id:
        return {**user_info, "allowed": True, "is_owner": True}

    # Shared user check — look through admin's friend list
    try:
        for friend in admin_account.users():
            if friend.id == user_account.id:
                for server in friend.servers:
                    if server.machineIdentifier == server_machine_id:
                        return {**user_info, "allowed": True, "is_owner": False}
                # User is a friend but doesn't have this server shared
                break
    except Exception:
        logger.exception("Failed to check shared users for server access")

    return {**user_info, "allowed": False, "is_owner": False}
