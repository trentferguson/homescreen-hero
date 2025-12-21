from __future__ import annotations

from typing import Optional
from datetime import date

import logging

from .integrations import (
    get_plex_server,
    sync_all_trakt_sources,
    apply_home_screen_selection,
)

from .config.loader import load_config
from .config.schema import AppConfig, RotationExecution, RotationResult
from .rotation import run_rotation_with_history
from .db import (
    init_db,
    get_rotation_history_context,
    record_rotation,
    create_simulation,
    get_simulation_by_id,
    mark_simulation_applied,
)


logger = logging.getLogger(__name__)

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

    # Check that Trakt-backed Plex collections are up to date
    sync_all_trakt_sources(server, config)

    max_rotation_id, usage_map = get_rotation_history_context()

    # Selects collections based on config and history
    rotation_result = run_rotation_with_history(
        config,
        max_rotation_id=max_rotation_id,
        usage_map=usage_map,
    )

    # Apply the selection (or simulate if dry_run=True)
    applied = apply_home_screen_selection(
        server,
        config,
        rotation_result.selected_collections,
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
    applied = apply_home_screen_selection(
        server,
        config,
        rotation_result.selected_collections,
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
