from .plex_client import get_plex_server, apply_home_screen_selection
from .trakt_client import get_trakt_client
from .trakt_sync import sync_all_trakt_sources  # or whatever you named it

__all__ = [
    "get_plex_server",
    "get_trakt_client",
    "sync_all_trakt_sources",
    "apply_home_screen_selection",
]
