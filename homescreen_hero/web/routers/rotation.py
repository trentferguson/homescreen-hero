from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Form, HTTPException, Path, Depends
from pydantic import BaseModel

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.service import (
    apply_simulation,
    run_rotation_once,
    simulate_rotation_once,
)
from homescreen_hero.core.config.schema import RotationExecution
from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.scheduler import get_scheduler, JOB_ID
from homescreen_hero.web.routers.collections import invalidate_collections_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rotate")


# Trigger a dry-run rotation and return the execution details as JSON, without touching Plex
@router.post("/dry-run", response_model=RotationExecution)
def rotate_dry_run(current_user: str = Depends(get_current_user)) -> RotationExecution:
    try:
        logger.info("Handling /rotate/dry-run request")
        execution = run_rotation_once(dry_run=True)
        return execution
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Rotation dry-run failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Trigger an immediate rotation and return the execution details as JSON
@router.post("/rotate-now", response_model=RotationExecution)
def rotate_now(current_user: str = Depends(get_current_user)) -> RotationExecution:
    try:
        logger.info("Handling /rotate-now request")
        execution = run_rotation_once(dry_run=False)
        # Invalidate collections cache so new Trakt collections are visible
        invalidate_collections_cache()
        return execution
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Rotation request failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Simulate a rotation and return the simulation details as JSON, without touching Plex
@router.post("/simulate-next", response_model=RotationExecution)
def simulate_next_rotation(current_user: str = Depends(get_current_user)) -> RotationExecution:
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
    current_user: str = Depends(get_current_user),
) -> RotationExecution:
    try:
        logger.info("Applying simulation %s", simulation_id)
        execution = apply_simulation(simulation_id)
        # Invalidate collections cache so new Trakt collections are visible
        invalidate_collections_cache()
        return execution
    except ValueError as exc:
        logger.warning("Simulation %s could not be applied: %s", simulation_id, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected failure applying simulation %s", simulation_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# Form-friendly variant of 'use_simulation' returning JSON (double check if still referenced?)
@router.post("/use-simulation-form", response_model=RotationExecution)
def use_simulation_form(
    simulation_id: int = Form(...),
    current_user: str = Depends(get_current_user),
) -> RotationExecution:
    try:
        execution = apply_simulation(simulation_id)
        # Invalidate collections cache so new Trakt collections are visible
        invalidate_collections_cache()
        return execution
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class SchedulerStatusResponse(BaseModel):
    enabled: bool
    interval_hours: int
    next_run_time: Optional[datetime] = None
    is_running: bool


@router.get("/scheduler-status", response_model=SchedulerStatusResponse)
def get_scheduler_status(current_user: str = Depends(get_current_user)) -> SchedulerStatusResponse:
    """Get the current scheduler status including next scheduled rotation time."""
    try:
        config = load_config()

        next_run_time = None
        is_running = False

        scheduler = get_scheduler()
        if scheduler and scheduler.running:
            is_running = True
            job = scheduler.get_job(JOB_ID)
            if job and job.next_run_time:
                next_run_time = job.next_run_time

        return SchedulerStatusResponse(
            enabled=config.rotation.enabled,
            interval_hours=config.rotation.interval_hours,
            next_run_time=next_run_time,
            is_running=is_running
        )
    except Exception as exc:
        logger.exception("Failed to get scheduler status")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
