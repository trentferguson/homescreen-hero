from __future__ import annotations

import logging
from fastapi import APIRouter, Form, HTTPException, Path

from homescreen_hero.core.service import (
    apply_simulation,
    run_rotation_once,
    simulate_rotation_once,
)
from homescreen_hero.core.config.schema import RotationExecution

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rotate")


# Trigger a dry-run rotation and return the execution details as JSON, without touching Plex
@router.post("/dry-run", response_model=RotationExecution)
def rotate_dry_run() -> RotationExecution:
    try:
        logger.info("Handling /rotate/dry-run request")
        execution = run_rotation_once(dry_run=True)
        return execution
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Rotation dry-run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Trigger an immediate rotation and return the execution details as JSON
@router.post("/rotate-now", response_model=RotationExecution)
def rotate_now() -> RotationExecution:
    try:
        logger.info("Handling /rotate-now request")
        execution = run_rotation_once(dry_run=False)
        return execution
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Rotation request failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Simulate a rotation and return the simulation details as JSON, without touching Plex
@router.post("/simulate-next", response_model=RotationExecution)
def simulate_next_rotation() -> RotationExecution:
    try:
        logger.info("Handling /simulate-next request")
        execution = simulate_rotation_once()
        return execution
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Simulation failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Use a previously simulated rotation by it's simulation ID
@router.post("/use-simulation/{simulation_id}", response_model=RotationExecution)
def use_simulation(
    simulation_id: int = Path(..., description="ID of the previously simulated rotation"),
) -> RotationExecution:
    try:
        logger.info("Applying simulation %s", simulation_id)
        execution = apply_simulation(simulation_id)
        return execution
    except ValueError as exc:
        logger.warning("Simulation %s could not be applied: %s", simulation_id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected failure applying simulation %s", simulation_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Form-friendly variant of 'use_simulation' returning JSON (double check if still referenced?)
@router.post("/use-simulation-form", response_model=RotationExecution)
def use_simulation_form(simulation_id: int = Form(...)) -> RotationExecution:
    try:
        execution = apply_simulation(simulation_id)
        return execution
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc
