from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Set

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
    # Build the set of all collection names referenced in your groups and integration sources
    names: Set[str] = set()

    # Add collections from groups
    for group in config.groups:
        for name in group.collections:
            names.add(name)

    # Add collections from Trakt sources
    if config.trakt and config.trakt.enabled and config.trakt.sources:
        for source in config.trakt.sources:
            names.add(source.name)

    # Add collections from Letterboxd sources
    if config.letterboxd and config.letterboxd.enabled and config.letterboxd.sources:
        for source in config.letterboxd.sources:
            names.add(source.name)

    # Add collections from MDBList sources
    if config.mdblist and config.mdblist.enabled and config.mdblist.sources:
        for source in config.mdblist.sources:
            names.add(source.name)

    return names


def cleanup_deleted_integration_sources(
    server: PlexServer,
    config: AppConfig,
    *,
    auto_update_config: bool = True,
) -> Dict[str, List[str]]:
    """
    Automatically detect and clean up collections that have been removed from config.

    This function:
    1. Identifies collections that were previously rotated but are no longer in:
       - Integration sources (Trakt/Letterboxd/MDBList)
       - Groups (manual collections or integration-backed collections)
       - Pinned collections
    2. Deletes those collections from Plex

    IMPORTANT: Collections are protected from deletion if they are:
    - Still in groups (manual or integration-backed)
    - Pinned by the user
    This preserves manually created Plex collections and user-pinned collections.

    Args:
        server: PlexServer instance
        config: Application configuration
        auto_update_config: Deprecated, no longer used (kept for API compatibility)

    Returns:
        Dict with keys:
            - 'deleted_from_plex': List of collection names deleted from Plex
            - 'orphaned_in_groups': List of collection names (always empty now)
            - 'config_updated': Boolean (always False now)
    """
    from ..db.history import get_rotation_history_context
    from ..config.loader import load_config_text, save_config_text, get_config_path
    import yaml

    # Get current integration source names
    current_integration_sources = set()

    if config.trakt and config.trakt.enabled and config.trakt.sources:
        for source in config.trakt.sources:
            current_integration_sources.add(source.name)

    if config.letterboxd and config.letterboxd.enabled and config.letterboxd.sources:
        for source in config.letterboxd.sources:
            current_integration_sources.add(source.name)

    if config.mdblist and config.mdblist.enabled and config.mdblist.sources:
        for source in config.mdblist.sources:
            current_integration_sources.add(source.name)

    # Get previously rotated collections from history
    _, usage_map = get_rotation_history_context()
    previously_rotated = set(usage_map.keys())

    # Get collections referenced in groups (might be manual collections)
    group_collections = set()
    for group in config.groups:
        for name in group.collections:
            group_collections.add(name)

    # Get pinned collections - users explicitly want these preserved
    from ..db import get_pinned_collection_names
    pinned_collections = get_pinned_collection_names()

    logger.info(f"Cleanup check - Previously rotated: {sorted(previously_rotated)}")
    logger.info(f"Cleanup check - Integration sources: {sorted(current_integration_sources)}")
    logger.info(f"Cleanup check - Group collections: {sorted(group_collections)}")
    logger.info(f"Cleanup check - Pinned collections: {sorted(pinned_collections)}")

    # Find collections that were from integration sources but have been deleted
    # CRITICAL: Only delete collections if they meet ALL criteria:
    # 1. Previously rotated (in history)
    # 2. NOT in current integration sources (source was removed)
    # 3. NOT in current groups (not a manual collection)
    # 4. NOT pinned by the user
    #
    # If a collection is still in a group or pinned, it's either:
    # - A manual Plex collection that should be preserved
    # - An integration source that will be synced later
    # - A collection the user explicitly pinned
    # Either way, we should NEVER delete it.

    # Collections that were rotated but are no longer protected
    deleted_sources = previously_rotated - current_integration_sources - group_collections - pinned_collections

    logger.info(f"Cleanup check - Will delete (not protected): {sorted(deleted_sources)}")

    deleted_from_plex = []
    orphaned_in_groups = []

    # Get enabled libraries
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    logger.info("Checking for deleted integration sources to clean up...")

    if deleted_sources:
        logger.warning(f"DELETING {len(deleted_sources)} collections: {sorted(deleted_sources)}")

        for collection_name in sorted(deleted_sources):
            # These collections are no longer in config at all, safe to delete

            # Try to find and delete this collection from Plex
            deleted = False
            for library_name in enabled_libraries:
                try:
                    library = server.library.section(library_name)
                    # Check if collection exists
                    for coll in library.collections():
                        if coll.title == collection_name:
                            logger.info(f"Deleting collection '{collection_name}' from Plex library '{library_name}' (removed from config)")
                            coll.delete()
                            deleted = True
                            deleted_from_plex.append(collection_name)
                            break
                except Exception as e:
                    logger.warning(f"Error checking/deleting collection '{collection_name}' in library '{library_name}': {e}")

            if not deleted:
                logger.debug(f"Collection '{collection_name}' not found in Plex (may have been manually deleted)")
    else:
        logger.info("No deleted integration sources found - all previously managed collections are still in config")

    # Since we now preserve collections that are in groups (manual collections),
    # we no longer need to auto-update the config to remove orphaned references.
    # Collections are only deleted if they're completely removed from both
    # integration sources AND groups.
    config_updated = False

    return {
        'deleted_from_plex': deleted_from_plex,
        'orphaned_in_groups': orphaned_in_groups,
        'config_updated': config_updated,
    }


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
    #   - Also include previously rotated collections (from CollectionUsage table)
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

    # Import here to avoid circular dependency
    from ..db.history import get_rotation_history_context

    # Get enabled libraries
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    if not enabled_libraries:
        logger.warning("No enabled libraries configured for rotation")
        return []

    selected_set = set(selected_collection_names)
    configured_names = get_configured_collection_names(config)

    # Get all collections that have ever been rotated to ensure we clean them up if removed
    _, usage_map = get_rotation_history_context()
    previously_rotated_names = set(usage_map.keys())

    # Process both currently configured collections AND previously rotated ones
    all_names_to_process = configured_names | previously_rotated_names

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
        "Applying home screen selection to %d total collections (%d configured, %d previously rotated) across %d libraries (dry_run=%s)",
        len(all_names_to_process),
        len(configured_names),
        len(previously_rotated_names),
        len(enabled_libraries),
        dry_run,
    )

    for name in sorted(all_names_to_process):
        coll = all_collections.get(name)
        if coll is None:
            # Collection not found in Plex - might have been deleted from Plex library
            if name in configured_names:
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
            # Collection is either configured but not selected, or was previously rotated but removed from config
            if name in previously_rotated_names and name not in configured_names:
                logger.info("Disabling visibility for previously managed collection (removed from config): %s", name)
            else:
                logger.debug("Disabling visibility for collection: %s", name)
            if not dry_run:
                hub.updateVisibility(home=False, shared=False, recommended=False)

    logger.info(
        "Home screen selection applied; %d collections enabled, %d collections processed",
        len(applied),
        len(all_names_to_process),
    )

    if dry_run:
        logger.info("Dry run — no changes were sent to Plex")

    # Reorder collections on the homescreen to match the selection order
    if applied and not dry_run:
        reorder_homescreen_collections(server, config, applied)

    return applied


def reorder_homescreen_collections(
    server: PlexServer,
    config: AppConfig,
    ordered_collection_names: List[str],
    *,
    dry_run: bool = False,
) -> List[str]:
    # Reorder collections on the Plex homescreen using ManagedHub.move().
    # Plex keeps libraries separate, so we reorder within each library.
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    # Build map: collection_name -> (ManagedHub, library_name)
    hub_map: Dict[str, tuple[Any, str]] = {}
    for library_name in enabled_libraries:
        try:
            library = server.library.section(library_name)
            hubs = library.managedHubs()
            for hub in hubs:
                if hasattr(hub, "title"):
                    hub_map[hub.title] = (hub, library_name)
        except Exception as e:
            logger.warning(
                "Could not get managed hubs for library %s: %s", library_name, e
            )

    logger.debug("Found %d collections available for reordering", len(hub_map))

    if dry_run:
        logger.info("Dry run - would reorder collections: %s", ordered_collection_names)
        return ordered_collection_names

    # Group requested collections by library, preserving order within each library
    library_orders: Dict[str, List[tuple[str, Any]]] = {}
    for name in ordered_collection_names:
        if name not in hub_map:
            # Collection might be a built-in Plex hub (not a custom collection)
            logger.debug("Skipping '%s' - not a custom collection or not found", name)
            continue
        hub, library_name = hub_map[name]
        if library_name not in library_orders:
            library_orders[library_name] = []
        library_orders[library_name].append((name, hub))

    # Reorder within each library
    applied_order: List[str] = []
    for library_name, collections in library_orders.items():
        logger.debug("Reordering %d collections in '%s'", len(collections), library_name)

        if len(collections) < 2:
            for name, _ in collections:
                applied_order.append(name)
            continue

        # Move first item to top, then position others relative to it
        first_name, first_hub = collections[0]
        try:
            first_hub.move(after=None)
            applied_order.append(first_name)
            logger.debug("Moved '%s' to top", first_name)
        except Exception as e:
            logger.warning("Failed to move collection '%s': %s", first_name, e)
            continue

        # Move subsequent items after the previous one
        prev_hub = first_hub
        for name, hub in collections[1:]:
            try:
                hub.move(after=prev_hub)
                applied_order.append(name)
                logger.debug("Moved '%s' after '%s'", name, prev_hub.title)
                prev_hub = hub
            except Exception as e:
                logger.warning("Failed to move collection '%s': %s", name, e)

    if applied_order:
        logger.info("Reordered %d collections on homescreen", len(applied_order))

    return applied_order
