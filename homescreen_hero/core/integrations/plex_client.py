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
    Automatically detect and clean up collections from deleted integration sources.

    This function:
    1. Identifies collections that were previously managed by Trakt/Letterboxd/MDBList
       but whose sources have been removed from config
    2. Deletes those collections from Plex
    3. Optionally removes orphaned references from groups in config.yaml

    Args:
        server: PlexServer instance
        config: Application configuration
        auto_update_config: If True, automatically updates config.yaml to remove
                           orphaned collection references from groups (default: True)

    Returns:
        Dict with keys:
            - 'deleted_from_plex': List of collection names deleted from Plex
            - 'orphaned_in_groups': List of collection names that were in groups
            - 'config_updated': Boolean indicating if config.yaml was updated
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

    # Find collections that were from integration sources but have been deleted
    # We want to delete these even if they're still referenced in groups
    deleted_sources = previously_rotated - current_integration_sources

    deleted_from_plex = []
    orphaned_in_groups = []

    # Get enabled libraries
    enabled_libraries = [lib.name for lib in config.plex.libraries if lib.enabled]

    logger.info("Checking for deleted integration sources to clean up...")

    if deleted_sources:
        logger.info(f"Found {len(deleted_sources)} deleted integration sources to clean up")

        for collection_name in sorted(deleted_sources):
            # Check if this collection is still in a group (orphaned reference)
            if collection_name in group_collections:
                orphaned_in_groups.append(collection_name)
                logger.warning(
                    f"Collection '{collection_name}' integration source was deleted but it's still "
                    f"referenced in a group. Deleting from Plex and you should remove from group config."
                )

            # Try to find and delete this collection from Plex
            deleted = False
            for library_name in enabled_libraries:
                try:
                    library = server.library.section(library_name)
                    # Check if collection exists
                    for coll in library.collections():
                        if coll.title == collection_name:
                            logger.info(f"Deleting collection '{collection_name}' from Plex library '{library_name}' (integration source removed)")
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

    # Auto-update config.yaml to remove orphaned references from groups
    config_updated = False
    if auto_update_config and orphaned_in_groups:
        try:
            logger.info(f"Auto-updating config.yaml to remove {len(orphaned_in_groups)} orphaned collection(s) from groups")

            # Load the config file as text
            config_path = get_config_path()
            config_text = load_config_text(config_path)

            # Parse YAML
            config_data = yaml.safe_load(config_text)

            # Track if we made any changes
            changes_made = False
            orphaned_set = set(orphaned_in_groups)

            # Remove orphaned collections from groups
            if 'groups' in config_data:
                for group in config_data['groups']:
                    if 'collections' in group and group['collections']:
                        original_count = len(group['collections'])
                        # Filter out orphaned collections
                        group['collections'] = [
                            c for c in group['collections']
                            if c not in orphaned_set
                        ]
                        removed_count = original_count - len(group['collections'])
                        if removed_count > 0:
                            logger.info(f"Removed {removed_count} orphaned collection(s) from group '{group.get('name', 'unknown')}'")
                            changes_made = True

            # Save the updated config if changes were made
            if changes_made:
                updated_yaml = yaml.dump(config_data, default_flow_style=False, sort_keys=False, allow_unicode=True)
                save_config_text(updated_yaml, config_path)
                config_updated = True
                logger.info("Config.yaml updated successfully - orphaned references removed from groups")

        except Exception as e:
            logger.error(f"Failed to auto-update config.yaml: {e}")
            logger.warning("You will need to manually remove orphaned collections from groups in config.yaml")

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

    return applied
