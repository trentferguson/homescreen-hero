from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional

from plexapi.server import PlexServer
from plexapi.exceptions import NotFound

from ..config.schema import AppConfig
from ..db.analytics import record_collection_analytics
from .tautulli_client import get_tautulli_client
from .plex_client import get_plex_server

logger = logging.getLogger(__name__)


def collect_analytics_for_collections(
    config: AppConfig,
    collection_names: List[str],
    rotation_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Collect analytics for specified collections from Tautulli.

    This function:
    1. Gets the Tautulli client
    2. Gets the Plex server
    3. For each collection:
        a. Finds the collection in Plex libraries
        b. Gets the rating_key from Plex
        c. Queries Tautulli for watch stats using the rating_key
        d. Stores the snapshot in the database

    Args:
        config: Application configuration
        collection_names: List of collection names to collect analytics for
        rotation_id: Optional rotation ID to link analytics to

    Returns:
        Dict with summary: {
            "status": "success" | "skipped",
            "collected": [{"collection": name, "plays": count}, ...],
            "failed": [{"collection": name, "reason": error}, ...],
            "total_collections": count
        }
    """
    # Get Tautulli client
    tautulli = get_tautulli_client(config)
    if not tautulli:
        logger.info("Tautulli not configured, skipping analytics collection")
        return {
            "status": "skipped",
            "reason": "Tautulli not enabled or configured",
            "collected": [],
            "failed": [],
            "total_collections": 0,
        }

    # Get Plex server
    try:
        plex = get_plex_server(config)
    except Exception as e:
        logger.error(f"Failed to connect to Plex server: {e}")
        return {
            "status": "error",
            "reason": f"Plex connection failed: {e}",
            "collected": [],
            "failed": [],
            "total_collections": 0,
        }

    results = {
        "status": "success",
        "collected": [],
        "failed": [],
        "total_collections": len(collection_names),
    }

    # Process each collection
    for collection_name in collection_names:
        try:
            # Find the collection in Plex libraries
            collection_obj = None
            library_name = None

            # Search through enabled libraries
            for lib_config in config.plex.libraries:
                if not lib_config.enabled:
                    continue

                try:
                    library = plex.library.section(lib_config.name)
                    collection_obj = library.collection(collection_name)
                    library_name = lib_config.name
                    logger.debug(
                        f"Found collection '{collection_name}' in library '{library_name}'"
                    )
                    break
                except NotFound:
                    continue
                except Exception as e:
                    logger.warning(
                        f"Error searching for '{collection_name}' in '{lib_config.name}': {e}"
                    )
                    continue

            if not collection_obj or not library_name:
                logger.warning(
                    f"Collection '{collection_name}' not found in any enabled Plex library"
                )
                results["failed"].append(
                    {
                        "collection": collection_name,
                        "reason": "Not found in Plex libraries",
                    }
                )
                continue

            # Get the rating_key (Plex's internal ID)
            rating_key = collection_obj.ratingKey
            logger.debug(
                f"Collection '{collection_name}' has rating_key: {rating_key}"
            )

            # Aggregate stats from all items in the collection
            # Tautulli tracks stats per-item, not per-collection
            total_plays = 0
            total_duration_seconds = 0
            items_with_plays = 0

            try:
                items = collection_obj.items()
                logger.debug(f"Collection has {len(items)} items")

                for item in items:
                    try:
                        item_stats = tautulli.get_collection_stats(item.ratingKey)
                        item_plays = item_stats.get("total_plays", 0)
                        item_duration = item_stats.get("total_duration", 0)

                        if item_plays > 0:
                            total_plays += item_plays
                            items_with_plays += 1

                        if item_duration:
                            total_duration_seconds += item_duration

                    except Exception as e:
                        logger.warning(
                            f"Failed to get stats for item {item.ratingKey} in '{collection_name}': {e}"
                        )
                        continue

                logger.info(
                    f"Aggregated stats for '{collection_name}': "
                    f"{total_plays} plays from {items_with_plays}/{len(items)} items"
                )

            except Exception as e:
                logger.error(f"Failed to get items from collection '{collection_name}': {e}")
                # Fall back to trying collection-level stats
                stats = tautulli.get_collection_stats(rating_key)
                total_plays = stats.get("total_plays", 0)
                total_duration_seconds = stats.get("total_duration", 0)

            # Store in database
            record_collection_analytics(
                collection_name=collection_name,
                plex_library=library_name,
                rating_key=rating_key,
                total_plays=total_plays,
                total_duration_seconds=total_duration_seconds,
                unique_users=None,  # Not available from current Tautulli endpoint
                rotation_id=rotation_id,
                extra_data={
                    "items_with_plays": items_with_plays,
                    "total_items": len(items) if 'items' in locals() else None,
                },
            )

            logger.info(
                f"Collected analytics for '{collection_name}': {total_plays} plays"
            )
            results["collected"].append(
                {
                    "collection": collection_name,
                    "plays": total_plays,
                    "rating_key": rating_key,
                }
            )

        except Exception as e:
            logger.error(
                f"Failed to collect analytics for '{collection_name}': {e}",
                exc_info=True,
            )
            results["failed"].append(
                {
                    "collection": collection_name,
                    "reason": str(e),
                }
            )

    # Log summary
    logger.info(
        f"Analytics collection complete: {len(results['collected'])} succeeded, "
        f"{len(results['failed'])} failed out of {results['total_collections']} total"
    )

    return results


def collect_analytics_for_all_active(config: AppConfig) -> Dict[str, Any]:
    """
    Collect analytics for all currently active (featured) collections.

    This queries Plex to find all collections that are currently promoted
    to the home screen, then collects analytics for them.

    Args:
        config: Application configuration

    Returns:
        Dict with summary (same format as collect_analytics_for_collections)
    """
    try:
        plex = get_plex_server(config)
    except Exception as e:
        logger.error(f"Failed to connect to Plex server: {e}")
        return {
            "status": "error",
            "reason": f"Plex connection failed: {e}",
            "collected": [],
            "failed": [],
            "total_collections": 0,
        }

    # Get all collections from enabled libraries
    active_collections = []

    for lib_config in config.plex.libraries:
        if not lib_config.enabled:
            continue

        try:
            library = plex.library.section(lib_config.name)
            collections = library.collections()

            # Filter for collections that are promoted (visibility > 0)
            for collection in collections:
                # Check if collection is promoted to home or shared
                # Note: PlexAPI may not expose visibility directly,
                # so we collect all collections for now
                active_collections.append(collection.title)

        except Exception as e:
            logger.error(
                f"Failed to get collections from library '{lib_config.name}': {e}"
            )
            continue

    if not active_collections:
        logger.info("No active collections found")
        return {
            "status": "success",
            "collected": [],
            "failed": [],
            "total_collections": 0,
        }

    logger.info(f"Found {len(active_collections)} collections to collect analytics for")

    # Collect analytics for all found collections
    return collect_analytics_for_collections(
        config=config,
        collection_names=active_collections,
        rotation_id=None,  # Not linked to a specific rotation
    )
