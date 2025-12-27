from __future__ import annotations

import logging
import os
from typing import Dict, Iterable, List, Set

from plexapi.server import PlexServer

from ..config.schema import AppConfig
from .mock_plex_client import MockPlexServer

logger = logging.getLogger(__name__)

def get_plex_server(config: AppConfig) -> PlexServer:
    # Create a PlexServer instance from the config
    base_url = config.plex.base_url
    token = config.plex.token

    logger.info("Connecting to Plex at %s", base_url)

    # Check if we're in demo mode (hardcoded for demo branch)
    # For demo branch, always use mock Plex
    logger.info("DEMO MODE: Using mock Plex server")
    server = MockPlexServer(base_url, token)
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
    collection_visibility: Dict[str, Dict[str, bool]],
    *,
    dry_run: bool = False,
) -> List[str]:
    # Apply the chosen collections to the Plex Home screen
    #
    # Strategy:
    #   - Build the union of all config-defined collection names
    #   - Fetch those collections from all enabled Plex libraries
    #   - For each:
    #       - If in selected_collection_names -> apply visibility settings from collection_visibility
    #       - Else -> disable all visibility (home=False, shared=False, recommended=False)
    #
    # Args:
    #   collection_visibility: Dict mapping collection name to visibility settings
    #       e.g. {"Christmas Classics": {"home": True, "shared": True, "recommended": False}}
    #
    # Returns a list of collection titles that were (or would be) set to show on Home

    # Get enabled libraries
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    if not enabled_libraries:
        logger.warning("No enabled libraries configured for rotation")
        return []

    selected_set = set(selected_collection_names)
    configured_names = get_configured_collection_names(config)

    # Fetch collections from all enabled libraries
    all_collections: Dict[str, object] = {}
    for library_name in enabled_libraries:
        logger.info("Fetching collections from library: %s", library_name)
        try:
            library_collections = get_library_collections(server, library_name)
            all_collections.update(library_collections)
        except Exception as e:
            logger.error("Failed to fetch collections from library '%s': %s", library_name, e)
            continue

    applied: List[str] = []

    logger.info(
        "Applying home screen selection to %d configured collections across %d libraries (dry_run=%s)",
        len(configured_names),
        len(enabled_libraries),
        dry_run,
    )

    for name in sorted(configured_names):
        coll = all_collections.get(name)
        if coll is None:
            logger.warning(
                "Configured collection not found in any enabled Plex library: %s",
                name,
            )
            continue

        hub = coll.visibility()

        if name in selected_set:
            # Get visibility settings for this collection
            visibility = collection_visibility.get(name, {
                "home": True,
                "shared": False,
                "recommended": False
            })

            logger.info(
                "Enabling visibility for collection '%s': home=%s, shared=%s, recommended=%s",
                name,
                visibility.get("home", True),
                visibility.get("shared", False),
                visibility.get("recommended", False)
            )
            applied.append(name)
            if not dry_run:
                hub.updateVisibility(
                    home=visibility.get("home", True),
                    shared=visibility.get("shared", False),
                    recommended=visibility.get("recommended", False)
                )
        else:
            logger.debug("Disabling all visibility for collection: %s", name)
            if not dry_run:
                hub.updateVisibility(home=False, shared=False, recommended=False)

    logger.info(
        "Home screen selection applied; %d collections enabled, %d configured",
        len(applied),
        len(configured_names),
    )

    if dry_run:
        logger.info("Dry run — no changes were sent to Plex")

    return applied
