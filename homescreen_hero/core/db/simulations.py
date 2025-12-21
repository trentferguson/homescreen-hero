from __future__ import annotations

from datetime import datetime
from typing import Optional

import json

from .base import session_scope
from .models import PendingSimulation
from homescreen_hero.core.config.schema import RotationResult  # pydantic model


def create_simulation(rotation_result: RotationResult) -> int:
    # Store this simulated rotation so it can be applied later

    featured = list(rotation_result.selected_collections)

    # IMPORTANT: make snapshot JSON-safe so the JSON column can store it  <-- Thanks ChatGPT, couldn't figure this one
    # Pydantic's .json() will serialize dates to ISO strings,
    # then we parse back to a plain dict of only JSON-native types.
    snapshot_json = rotation_result.json()
    snapshot = json.loads(snapshot_json)

    with session_scope() as db:
        sim = PendingSimulation(
            selected_collections=featured,
            rotation_snapshot=snapshot,
            applied=False,
        )
        db.add(sim)
        db.flush()
        return sim.id


def get_simulation_by_id(sim_id: int) -> Optional[PendingSimulation]:
    with session_scope() as db:
        sim = db.get(PendingSimulation, sim_id)

        return sim


def mark_simulation_applied(sim_id: int) -> None:
    with session_scope() as db:
        sim = db.get(PendingSimulation, sim_id)
        if sim is None:
            return
        sim.applied = True
        sim.applied_at = datetime.utcnow()
