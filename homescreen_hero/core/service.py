from __future__ import annotations

from typing import Dict, List, Optional
from datetime import date

import logging

from .integrations import (
    get_plex_server,
    sync_all_trakt_sources,
    sync_all_letterboxd_sources,
    sync_all_mdblist_sources,
    sync_all_anilist_sources,
    sync_all_mal_sources,
    apply_home_screen_selection,
)
from .integrations.plex_client import get_library_collections
from .config.loader import load_config
from .config.schema import AppConfig, RotationExecution, RotationResult
from .rotation import run_rotation_with_history, run_auto_rotation_with_history, build_collection_visibility_map, build_collection_sort_map
from .smart_groups import build_collection_metadata, resolve_smart_rules
from .db import (
    init_db,
    get_last_rotation_collections,
    get_rotation_history_context,
    record_rotation,
    create_simulation,
    get_simulation_by_id,
    mark_simulation_applied,
    get_pinned_collection_names,
)


logger = logging.getLogger(__name__)


def _build_collection_library_map(server, config: AppConfig) -> Dict[str, str]:
    # Build a mapping from collection name to library name.
    # Used to enforce per-library limits during rotation.
    coll_to_lib: Dict[str, str] = {}
    for lib_config in config.plex.libraries:
        if lib_config.enabled:
            try:
                collections_map = get_library_collections(server, lib_config.name)
                for coll_name in collections_map.keys():
                    coll_to_lib[coll_name] = lib_config.name
            except Exception as e:
                logger.warning("Failed to get collections from library '%s': %s", lib_config.name, e)
    return coll_to_lib


def _resolve_smart_groups(server, config: AppConfig) -> Dict[str, List[str]]:
    # Resolve all smart groups into concrete collection name lists.
    # Returns a dict mapping group name -> resolved collection names.
    smart_groups = [g for g in config.groups if g.smart]
    if not smart_groups:
        return {}

    logger.info("Resolving %d smart group(s)", len(smart_groups))
    metadata = build_collection_metadata(server, config)
    result = {}
    for group in smart_groups:
        resolved = resolve_smart_rules(group.rules, metadata)
        result[group.name] = resolved
        logger.info("Smart group '%s' resolved to %d collections", group.name, len(resolved))
    return result


def _run_auto_rotation(
    server,
    config: AppConfig,
    max_rotation_id: int,
    usage_map: Dict,
    pinned_names: set,
    last_rotation_collections: List[str],
    collection_library_map: Optional[Dict[str, str]] = None,
) -> RotationResult:
    # Run auto-rotation mode: rotate through collections from selected libraries
    auto_rotate = config.rotation.auto_rotate

    # Determine which libraries to use
    if auto_rotate.libraries:
        # Use explicitly configured libraries
        library_names = auto_rotate.libraries
    else:
        # Fall back to all enabled libraries
        library_names = [lib.name for lib in config.plex.libraries if lib.enabled]

    if not library_names:
        raise ValueError("Auto-rotate enabled but no libraries specified or available")

    logger.info("Auto-rotate mode: fetching collections from libraries: %s", library_names)

    # Pool collections from all selected libraries
    all_collection_names: List[str] = []
    for library_name in library_names:
        try:
            collections_map = get_library_collections(server, library_name)
            all_collection_names.extend(collections_map.keys())
            logger.info("Found %d collections in library '%s'", len(collections_map), library_name)
        except Exception as e:
            logger.warning("Failed to get collections from library '%s': %s", library_name, e)

    # Remove duplicates while preserving order
    seen = set()
    unique_collections = []
    for name in all_collection_names:
        if name not in seen:
            seen.add(name)
            unique_collections.append(name)
    all_collection_names = unique_collections

    logger.info("Total: %d unique collections across %d libraries", len(all_collection_names), len(library_names))

    return run_auto_rotation_with_history(
        all_collection_names,
        max_collections=config.rotation.max_collections,
        strategy=config.rotation.strategy,
        blacklisted_collections=config.rotation.blacklisted_collections,
        allow_repeats=config.rotation.allow_repeats,
        last_rotation_collections=last_rotation_collections,
        max_rotation_id=max_rotation_id,
        usage_map=usage_map,
        pinned_names=pinned_names,
        collection_library_map=collection_library_map,
        per_library_limits=config.rotation.per_library_limits,
    )


def _sync_selected_collections(
    server,
    config: AppConfig,
    selected_collections: List[str],
) -> None:
    # Sync only the collections that were selected for rotation.
    # Checks if each selected collection corresponds to a Trakt, Letterboxd, or MDBList source and syncs only those sources.
    from .integrations.trakt_sync import sync_single_trakt_source
    from .integrations.letterboxd_sync import sync_single_letterboxd_source
    from .integrations.mdblist_sync import sync_single_mdblist_source
    from .integrations.anilist_sync import sync_single_anilist_source
    from .integrations.mal_sync import sync_single_mal_source
    from .db import record_sync_result

    # Build a map of collection name -> source for quick lookup
    trakt_sources = {}
    letterboxd_sources = {}
    mdblist_sources = {}
    anilist_sources = {}
    mal_sources = {}

    if config.trakt and config.trakt.enabled:
        for source in config.trakt.sources:
            trakt_sources[source.name] = source

    if config.letterboxd and config.letterboxd.sources:
        for source in config.letterboxd.sources:
            letterboxd_sources[source.name] = source

    if config.mdblist and config.mdblist.enabled:
        for source in config.mdblist.sources:
            mdblist_sources[source.name] = source

    if config.anilist and config.anilist.sources:
        for source in config.anilist.sources:
            anilist_sources[source.name] = source

    if config.mal and config.mal.enabled:
        for source in config.mal.sources:
            mal_sources[source.name] = source

    def _sync_and_record(integration_type: str, source, sync_fn):
        try:
            total, matched = sync_fn(server, config, source)
            record_sync_result(
                integration_type=integration_type,
                source_name=source.name,
                source_url=source.url,
                items_total=total,
                items_matched=matched,
            )
        except Exception as exc:
            logger.error(f"Error syncing {integration_type} source '{source.name}': {exc}")
            record_sync_result(
                integration_type=integration_type,
                source_name=source.name,
                source_url=source.url,
                items_total=0,
                items_matched=0,
                sync_status="error",
                error_message=str(exc),
            )

    # Sync only the selected collections
    for collection_name in selected_collections:
        if collection_name in trakt_sources:
            logger.info(f"Syncing selected Trakt collection: {collection_name}")
            _sync_and_record("trakt", trakt_sources[collection_name], sync_single_trakt_source)
        elif collection_name in letterboxd_sources:
            logger.info(f"Syncing selected Letterboxd collection: {collection_name}")
            _sync_and_record("letterboxd", letterboxd_sources[collection_name], sync_single_letterboxd_source)
        elif collection_name in mdblist_sources:
            logger.info(f"Syncing selected MDBList collection: {collection_name}")
            _sync_and_record("mdblist", mdblist_sources[collection_name], sync_single_mdblist_source)
        elif collection_name in anilist_sources:
            logger.info(f"Syncing selected AniList collection: {collection_name}")
            _sync_and_record("anilist", anilist_sources[collection_name], sync_single_anilist_source)
        elif collection_name in mal_sources:
            logger.info(f"Syncing selected MAL collection: {collection_name}")
            _sync_and_record("mal", mal_sources[collection_name], sync_single_mal_source)
        else:
            logger.debug(f"Collection '{collection_name}' is not a synced source, skipping sync")


def run_rotation_once(
    config: Optional[AppConfig] = None,
    *,
    dry_run: bool = False,
) -> RotationExecution:
    # Orchestrate a single, history-aware rotation against Plex
    #
    # dry_run:
    #   - When True: do NOT change Plex, but DO update rotation history
    #   - When False: change Plex and update rotation history
    if config is None:
        config = load_config()

    logger.info("Starting rotation (dry_run=%s)", dry_run)

    # Ensure DB tables exist
    init_db()

    # Connect to Plex
    server = get_plex_server(config)

    # Build collection→library map for per-library limits
    collection_library_map = _build_collection_library_map(server, config)

    # Resolve smart groups into concrete collection lists
    smart_group_collections = _resolve_smart_groups(server, config)

    # DISABLED: Auto-cleanup was too aggressive and deleting user's collections
    # TODO: Redesign cleanup to only delete collections that HSH created (not native Plex collections)
    # cleanup_result = cleanup_deleted_integration_sources(server, config)
    # if cleanup_result['deleted_from_plex']:
    #     logger.info(f"Cleaned up {len(cleanup_result['deleted_from_plex'])} deleted integration sources from Plex")

    # Check if auto-rotate mode is enabled
    use_auto_rotate = config.rotation.auto_rotate.enabled

    # Determine sync strategy based on config
    if config.rotation.sync_all_on_rotation:
        # Sync all Trakt, Letterboxd, and MDBList sources
        # Errors are non-fatal: if sync fails, rotation continues with existing Plex collections
        logger.info("Syncing all integration sources")
        try:
            sync_all_trakt_sources(server, config)
        except Exception as e:
            logger.error("Trakt sync failed, continuing with rotation: %s", e)
        try:
            sync_all_letterboxd_sources(server, config)
        except Exception as e:
            logger.error("Letterboxd sync failed, continuing with rotation: %s", e)
        try:
            sync_all_mdblist_sources(server, config)
        except Exception as e:
            logger.error("MDBList sync failed, continuing with rotation: %s", e)
        try:
            sync_all_anilist_sources(server, config)
        except Exception as e:
            logger.error("AniList sync failed, continuing with rotation: %s", e)
        try:
            sync_all_mal_sources(server, config)
        except Exception as e:
            logger.error("MAL sync failed, continuing with rotation: %s", e)
    else:
        # First, select collections to determine which ones need syncing
        logger.info("Selective sync mode: will only sync collections selected for rotation")
        max_rotation_id, usage_map = get_rotation_history_context()
        pinned_names = get_pinned_collection_names()
        last_rotation_collections = get_last_rotation_collections()

        if use_auto_rotate:
            rotation_result = _run_auto_rotation(
                server, config, max_rotation_id, usage_map, pinned_names, last_rotation_collections,
                collection_library_map=collection_library_map,
            )
        else:
            rotation_result = run_rotation_with_history(
                config,
                max_rotation_id=max_rotation_id,
                usage_map=usage_map,
                last_rotation_collections=last_rotation_collections,
                pinned_names=pinned_names,
                collection_library_map=collection_library_map,
                smart_group_collections=smart_group_collections,
            )

        # Now sync only the selected collections
        _sync_selected_collections(server, config, rotation_result.selected_collections)

    # If we did a full sync, now select collections
    if config.rotation.sync_all_on_rotation:
        max_rotation_id, usage_map = get_rotation_history_context()
        pinned_names = get_pinned_collection_names()
        last_rotation_collections = get_last_rotation_collections()

        if use_auto_rotate:
            rotation_result = _run_auto_rotation(
                server, config, max_rotation_id, usage_map, pinned_names, last_rotation_collections,
                collection_library_map=collection_library_map,
            )
        else:
            rotation_result = run_rotation_with_history(
                config,
                max_rotation_id=max_rotation_id,
                usage_map=usage_map,
                last_rotation_collections=last_rotation_collections,
                pinned_names=pinned_names,
                smart_group_collections=smart_group_collections,
                collection_library_map=collection_library_map,
            )

    # Build visibility map from group settings (or use auto-rotate config)
    if use_auto_rotate:
        # For auto-rotate, apply visibility settings from config
        auto_rotate = config.rotation.auto_rotate
        auto_visibility = {
            "home": auto_rotate.visibility_home,
            "shared": auto_rotate.visibility_shared,
            "recommended": auto_rotate.visibility_recommended,
        }
        collection_visibility = {
            name: auto_visibility.copy()
            for name in rotation_result.selected_collections
        }
    else:
        collection_visibility = build_collection_visibility_map(config, smart_group_collections)

    # Add pinned collection visibility (overrides group settings for pinned collections)
    from .db import get_pinned_visibility_map
    pinned_visibility = get_pinned_visibility_map()
    collection_visibility.update(pinned_visibility)

    # Build sort map from group settings
    collection_sort = build_collection_sort_map(config, smart_group_collections)

    # Apply the selection (or simulate if dry_run=True)
    applied = apply_home_screen_selection(
        server,
        config,
        rotation_result.selected_collections,
        collection_visibility,
        dry_run=dry_run,  # controls whether Plex is actually changed
        smart_group_collections=smart_group_collections,
        collection_sort=collection_sort,
    )

    rotation_id = record_rotation(
        rotation_result.selected_collections,
        success=True,
        error_message=None,
    )

    # Collect analytics after rotation if Tautulli is enabled
    if not dry_run and config.tautulli and config.tautulli.enabled:
        if config.tautulli.collect_on_rotation:
            try:
                from .integrations.tautulli_analytics import collect_analytics_for_collections
                logger.info("Collecting analytics after rotation %d", rotation_id)
                analytics_result = collect_analytics_for_collections(
                    config=config,
                    collection_names=rotation_result.selected_collections,
                    rotation_id=rotation_id,
                )
                logger.info(
                    "Analytics collection complete: %d succeeded, %d failed",
                    len(analytics_result.get("collected", [])),
                    len(analytics_result.get("failed", [])),
                )
            except Exception as e:
                logger.error("Failed to collect analytics after rotation: %s", e, exc_info=True)
                # Don't fail the rotation if analytics collection fails

    execution = RotationExecution(
        rotation=rotation_result,
        applied_collections=applied,
        dry_run=dry_run,
    )

    logger.info("Selected collections: %s", rotation_result.selected_collections)
    logger.info("Applied collections: %s", applied)
    logger.info("Rotation complete (dry_run=%s)", dry_run)

    return execution


def simulate_rotation_once(
    config: Optional[AppConfig] = None,
) -> RotationExecution:
    # Pure simulation:
    #   - Uses current history to respect min_gap_rotations
    #   - DOES NOT modify Plex
    #   - DOES NOT write to rotation history
    #   - DOES persist a PendingSimulation so it can be applied later
    if config is None:
        config = load_config()

    init_db()
    max_rotation_id, usage_map = get_rotation_history_context()
    last_rotation_collections = get_last_rotation_collections()

    logger.info("Simulating next rotation (no Plex write, no history write)")

    pinned_names = get_pinned_collection_names()
    server = get_plex_server(config)
    collection_library_map = _build_collection_library_map(server, config)

    # Resolve smart groups into concrete collection lists
    smart_group_collections = _resolve_smart_groups(server, config)

    # Check if auto-rotate mode is enabled
    if config.rotation.auto_rotate.enabled:
        rotation_result = _run_auto_rotation(
            server, config, max_rotation_id, usage_map, pinned_names, last_rotation_collections,
            collection_library_map=collection_library_map,
        )
    else:
        rotation_result = run_rotation_with_history(
            config,
            max_rotation_id=max_rotation_id,
            usage_map=usage_map,
            last_rotation_collections=last_rotation_collections,
            pinned_names=pinned_names,
            collection_library_map=collection_library_map,
            smart_group_collections=smart_group_collections,
        )

    simulation_id = create_simulation(rotation_result)

    logger.info(
        "Simulation %s created with collections: %s",
        simulation_id,
        rotation_result.selected_collections,
    )

    execution = RotationExecution(
        rotation=rotation_result,
        applied_collections=list(rotation_result.selected_collections),
        dry_run=True,
        simulation_id=simulation_id,
    )
    return execution


# Take a previously simulated rotation and actually apply it to Plex
def sync_all_sources(config: Optional[AppConfig] = None) -> Dict[str, int]:
    # Sync all Trakt, Letterboxd, and MDBList sources without running a rotation.
    if config is None:
        config = load_config()

    logger.info("Starting manual sync of all sources")

    # Ensure DB tables exist
    init_db()

    # Connect to Plex
    server = get_plex_server(config)

    # DISABLED: Auto-cleanup was too aggressive and could delete collections
    # managed by other tools (e.g. Kometa). Same issue as the rotation path.
    # TODO: Redesign cleanup to only delete collections that HSH created
    # cleanup_result = cleanup_deleted_integration_sources(server, config)
    # if cleanup_result['deleted_from_plex']:
    #     logger.info(f"Cleaned up {len(cleanup_result['deleted_from_plex'])} deleted integration sources from Plex")

    # Sync all sources
    sync_all_trakt_sources(server, config)
    sync_all_letterboxd_sources(server, config)
    sync_all_mdblist_sources(server, config)
    sync_all_anilist_sources(server, config)
    sync_all_mal_sources(server, config)

    logger.info("Manual sync complete")

    return {
        "status": "success",
    }


def apply_simulation(
    simulation_id: int,
    config: Optional[AppConfig] = None,
) -> RotationExecution:
    if config is None:
        config = load_config()

    init_db()

    sim = get_simulation_by_id(simulation_id)
    if sim is None:
        raise ValueError(f"Simulation {simulation_id} not found")
    if sim.applied:
        raise ValueError(f"Simulation {simulation_id} has already been applied")

    logger.info("Applying simulation %s", simulation_id)

    # If available, reconstruct RotationResult
    if sim.rotation_snapshot:
        rotation_result = RotationResult(**sim.rotation_snapshot)
    else:
        selected = list(sim.selected_collections or [])
        rotation_result = RotationResult(
            selected_collections=selected,
            groups=[],
            max_global=len(selected),
            remaining_global=0,
            today=date.today(),
        )

    # Apply collections to Plex
    server = get_plex_server(config)

    # Resolve smart groups for visibility mapping
    smart_group_collections = _resolve_smart_groups(server, config)

    # Build visibility map (auto-rotate uses its own settings)
    if config.rotation.auto_rotate.enabled:
        auto_rotate = config.rotation.auto_rotate
        auto_visibility = {
            "home": auto_rotate.visibility_home,
            "shared": auto_rotate.visibility_shared,
            "recommended": auto_rotate.visibility_recommended,
        }
        collection_visibility = {
            name: auto_visibility.copy()
            for name in rotation_result.selected_collections
        }
    else:
        collection_visibility = build_collection_visibility_map(config, smart_group_collections)

    # Add pinned collection visibility (overrides group settings for pinned collections)
    from .db import get_pinned_visibility_map
    pinned_visibility = get_pinned_visibility_map()
    collection_visibility.update(pinned_visibility)

    applied = apply_home_screen_selection(
        server,
        config,
        rotation_result.selected_collections,
        collection_visibility,
        dry_run=False,
        smart_group_collections=smart_group_collections,
    )

    # Record in db as a real rotation in history
    record_rotation(
        rotation_result.selected_collections,
        success=True,
        error_message=None,
    )

    # Mark simulation as applied
    mark_simulation_applied(simulation_id)

    logger.info(
        "Simulation %s applied. Collections: %s",
        simulation_id,
        rotation_result.selected_collections,
    )

    execution = RotationExecution(
        rotation=rotation_result,
        applied_collections=applied,
        dry_run=False,
        simulation_id=simulation_id,
    )
    return execution
