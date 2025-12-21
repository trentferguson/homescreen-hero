from __future__ import annotations

import logging
from typing import Dict, Iterable, List, Set

from plexapi.server import PlexServer

from ..config.schema import AppConfig

logger = logging.getLogger(__name__)

def get_plex_server(config: AppConfig) -> PlexServer:
    # Create a PlexServer instance from the config
    base_url = config.plex.base_url
    token = config.plex.token

    logger.info("Connecting to Plex at %s", base_url)

    # Raises if connection fails, which is good for early detection
    server = PlexServer(base_url, token)
    return server


def get_library_collections(
    server: PlexServer,
    library_name: str,
) -> Dict[str, object]:
    # Return a dict mapping collection title -> Collection object
    library = server.library.section(library_name)
    collections = library.collections()

    by_title: Dict[str, object] = {}
    for coll in collections:
        # Titles are case-sensitive in Plex, but we'll store as-is
        by_title[coll.title] = coll

    return by_title


def get_configured_collection_names(config: AppConfig) -> Set[str]:
    # Build the set of all collection names referenced in your groups
    names: Set[str] = set()
    for group in config.groups:
        for name in group.collections:
            names.add(name)
    return names


def apply_home_screen_selection(
    server: PlexServer,
    config: AppConfig,
    selected_collection_names: Iterable[str],
    *,
    dry_run: bool = False,
) -> List[str]:
    # Apply the chosen collections to the Plex Home screen
    #
    # Strategy:
    #   - Build the union of all config-defined collection names
    #   - Fetch those collections from Plex
    #   - For each:
    #       - If in selected_collection_names -> home=True
    #       - Else -> home=False
    #
    # Returns a list of collection titles that were (or would be) set to show on Home

    library_name = config.plex.library_name
    selected_set = set(selected_collection_names)

    configured_names = get_configured_collection_names(config)

    # Map of all collections in the library, keyed by title
    all_collections = get_library_collections(server, library_name)

    applied: List[str] = []

    logger.info(
        "Applying home screen selection to %d configured collections (dry_run=%s)",
        len(configured_names),
        dry_run,
    )

    for name in sorted(configured_names):
        coll = all_collections.get(name)
        if coll is None:
            logger.warning(
                "Configured collection not found in Plex library '%s': %s",
                library_name,
                name,
            )
            continue

        hub = coll.visibility()

        if name in selected_set:
            logger.info("Enabling Home visibility for collection: %s", name)
            applied.append(name)
            if not dry_run:
                hub.updateVisibility(home=True)
        else:
            logger.debug("Disabling Home visibility for collection: %s", name)
            if not dry_run:
                hub.updateVisibility(home=False)

        logger.info(
            "Home screen selection applied; %d collections enabled, %d configured",
            len(applied),
            len(configured_names),
        )

        if dry_run:
            logger.info("Dry run — no changes were sent to Plex")

    return applied
