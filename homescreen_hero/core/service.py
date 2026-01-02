from __future__ import annotations

from typing import Dict, List, Optional
from datetime import date

import logging

from .integrations import (
    get_plex_server,
    sync_all_trakt_sources,
    sync_all_letterboxd_sources,
    sync_all_letterboxd_sources,
    apply_home_screen_selection,
)

from .config.loader import load_config
from .config.schema import AppConfig, RotationExecution, RotationResult
from .rotation import run_rotation_with_history, build_collection_visibility_map
from .db import (
    init_db,
    get_rotation_history_context,
    record_rotation,
    create_simulation,
    get_simulation_by_id,
    mark_simulation_applied,
)


logger = logging.getLogger(__name__)


def _sync_selected_collections(
    server,
    config: AppConfig,
    selected_collections: List[str],
) -> None:
    """
    Sync only the collections that were selected for rotation.

    This checks if each selected collection corresponds to a Trakt or Letterboxd
    source and syncs only those sources.
    """
    from .integrations.trakt_sync import sync_single_trakt_source
    from .integrations.letterboxd_sync import sync_single_letterboxd_source

    # Build a map of collection name -> source for quick lookup
    trakt_sources = {}
    letterboxd_sources = {}

    if config.trakt and config.trakt.enabled:
        for source in config.trakt.sources:
            trakt_sources[source.name] = source

    if config.letterboxd and config.letterboxd.enabled:
        for source in config.letterboxd.sources:
            letterboxd_sources[source.name] = source

    # Sync only the selected collections
    for collection_name in selected_collections:
        if collection_name in trakt_sources:
            logger.info(f"Syncing selected Trakt collection: {collection_name}")
            sync_single_trakt_source(server, config, trakt_sources[collection_name])
        elif collection_name in letterboxd_sources:
            logger.info(f"Syncing selected Letterboxd collection: {collection_name}")
            sync_single_letterboxd_source(server, config, letterboxd_sources[collection_name])
        else:
            logger.debug(f"Collection '{collection_name}' is not a Trakt or Letterboxd source, skipping sync")


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

    # Determine sync strategy based on config
    if config.rotation.sync_all_on_rotation:
        # Sync all Trakt and Letterboxd sources
        logger.info("Syncing all Trakt and Letterboxd sources")
        sync_all_trakt_sources(server, config)
        sync_all_letterboxd_sources(server, config)
    else:
        # First, select collections to determine which ones need syncing
        logger.info("Selective sync mode: will only sync collections selected for rotation")
        max_rotation_id, usage_map = get_rotation_history_context()
        rotation_result = run_rotation_with_history(
            config,
            max_rotation_id=max_rotation_id,
            usage_map=usage_map,
        )

        # Now sync only the selected collections
        _sync_selected_collections(server, config, rotation_result.selected_collections)

    # If we did a full sync, now select collections
    if config.rotation.sync_all_on_rotation:
        max_rotation_id, usage_map = get_rotation_history_context()
        rotation_result = run_rotation_with_history(
            config,
            max_rotation_id=max_rotation_id,
            usage_map=usage_map,
        )

    # Build visibility map from group settings
    collection_visibility = build_collection_visibility_map(config)

    # Apply the selection (or simulate if dry_run=True)
    applied = apply_home_screen_selection(
        server,
        config,
        rotation_result.selected_collections,
        collection_visibility,
        dry_run=dry_run,  # controls whether Plex is actually changed
    )

    record_rotation(
        rotation_result.selected_collections,
        success=True,
        error_message=None,
    )

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

    logger.info("Simulating next rotation (no Plex write, no history write)")

    rotation_result = run_rotation_with_history(
        config,
        max_rotation_id=max_rotation_id,
        usage_map=usage_map,
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
    """
    Sync all Trakt and Letterboxd sources without running a rotation.

    Returns:
        Dictionary with sync statistics
    """
    if config is None:
        config = load_config()

    logger.info("Starting manual sync of all sources")

    # Ensure DB tables exist
    init_db()

    # Connect to Plex
    server = get_plex_server(config)

    # Sync all sources
    sync_all_trakt_sources(server, config)
    sync_all_letterboxd_sources(server, config)

    logger.info("Manual sync complete")

    return {"status": "success"}


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
    collection_visibility = build_collection_visibility_map(config)
    applied = apply_home_screen_selection(
        server,
        config,
        rotation_result.selected_collections,
        collection_visibility,
        dry_run=False,
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
