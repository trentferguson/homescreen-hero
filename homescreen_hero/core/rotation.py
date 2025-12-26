from __future__ import annotations

import logging
import random
from datetime import date
from typing import Dict, List, Optional, Set, Tuple

from .config.schema import (
    AppConfig,
    CollectionGroupConfig,
    DateRange,
    GroupSelectionResult,
    RotationResult,
)
from .db import CollectionUsage

logger = logging.getLogger(__name__)

def _parse_month_day(value: str) -> Tuple[int, int]:
    try:
        month_str, day_str = value.split("-", 1)
        month = int(month_str)
        day = int(day_str)
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError(f"Invalid MM-DD date format: {value!r}") from exc

    if not (1 <= month <= 12):
        raise ValueError(f"Month out of range in {value!r}")
    if not (1 <= day <= 31):
        raise ValueError(f"Day out of range in {value!r}")

    return month, day


def _is_date_in_range(today: date, dr: DateRange) -> bool:
    # Check if today's month/day falls within specified DateRange.
    start_m, start_d = _parse_month_day(dr.start)
    end_m, end_d = _parse_month_day(dr.end)

    today_tuple = (today.month, today.day)
    start_tuple = (start_m, start_d)
    end_tuple = (end_m, end_d)

    if start_tuple <= end_tuple:
        return start_tuple <= today_tuple <= end_tuple
    else:
        return today_tuple >= start_tuple or today_tuple <= end_tuple


def _group_is_active(group: CollectionGroupConfig, today: date) -> bool:
    # Determine if a group is active given today's date.
    if not group.enabled:
        return False

    if group.date_range is None:
        return True

    return _is_date_in_range(today, group.date_range)


def _passes_gap_rule(
    collection_name: str,
    group: CollectionGroupConfig,
    max_rotation_id: int,
    usage_map: Dict[str, CollectionUsage],
) -> bool:
    
    # If no gap requirement, always OK
    if group.min_gap_rotations <= 0:
        return True

    if max_rotation_id == 0:
        # No previous rotations at all
        return True

    usage = usage_map.get(collection_name)
    if usage is None or usage.last_rotation_id is None:
        # Never used before
        return True

    gap = max_rotation_id - usage.last_rotation_id
    return gap >= group.min_gap_rotations


# Same as run_rotation_dry, but respects history for gap rules
def run_rotation_with_history(
    config: AppConfig,
    *,
    max_rotation_id: int,
    usage_map: Dict[str, CollectionUsage],
    today: Optional[date] = None,
    rng: Optional[random.Random] = None,
) -> RotationResult:
    if today is None:
        today = date.today()
    if rng is None:
        rng = random.Random()

    max_global = config.rotation.max_collections
    remaining_global = max_global

    selected: List[str] = []
    selected_set: Set[str] = set()
    group_results: List[GroupSelectionResult] = []

    logger.info(
        "Starting rotation with history: %d max rotations observed", max_rotation_id
    )

    for group in config.groups:
        is_active = _group_is_active(group, today)

        result = GroupSelectionResult(
            group_name=group.name,
            active=is_active,
            min_picks=group.min_picks,
            max_picks=group.max_picks,
            available_collections=list(group.collections),
            chosen_collections=[],
            picked_count=0,
            reason_skipped=None,
        )

        if not is_active:
            result.reason_skipped = "Group disabled or outside date_range"
            group_results.append(result)
            continue

        if remaining_global <= 0:
            result.reason_skipped = (
                "Global max_collections reached before this group was processed"
            )
            group_results.append(result)
            continue

        # Filter out collections already chosen in this rotation
        available = [c for c in group.collections if c not in selected_set]

        # Apply gap rule based on history
        available = [
            c
            for c in available
            if _passes_gap_rule(c, group, max_rotation_id, usage_map)
        ]
        result.available_collections = available

        if not available:
            result.reason_skipped = (
                "No available collections after applying gap rule and duplicates filter"
            )
            group_results.append(result)
            continue

        max_for_group = min(
            group.max_picks,
            remaining_global,
            len(available),
        )

        if max_for_group <= 0:
            result.reason_skipped = (
                "max_picks for this group or global cap prevented any selection"
            )
            group_results.append(result)
            continue

        min_for_group = min(group.min_picks, max_for_group)

        if min_for_group == max_for_group:
            k = max_for_group
        else:
            k = rng.randint(min_for_group, max_for_group)

        if k <= 0:
            result.reason_skipped = "Randomly chose to pick 0 from this group"
            group_results.append(result)
            continue

        chosen = rng.sample(available, k=k)

        selected.extend(chosen)
        selected_set.update(chosen)
        remaining_global -= k

        result.chosen_collections = chosen
        result.picked_count = k

        group_results.append(result)

        if remaining_global <= 0:
            break

    rotation_result = RotationResult(
        selected_collections=selected,
        groups=group_results,
        max_global=max_global,
        remaining_global=remaining_global,
        today=today,
    )

    logger.info(
            "Rotation complete with history: %d selected, %d remaining",
            len(selected),
            remaining_global,
        )
    logger.debug("Group selection details: %s", group_results)
    
    return rotation_result


def run_rotation_dry(
    config: AppConfig,
    *,
    today: Optional[date] = None,               # Core Rotation Logic:
    rng: Optional[random.Random] = None,        # For each active group:
) -> RotationResult:                            #   1. Choose between min_picks and max_picks collections (if available)
                                                #   2. Respect the global rotation.max_collections cap
    if today is None:                           #   3. Avoid duplicates within this rotation
        today = date.today()                    # Returns detailed RotationResult with the following:
    if rng is None:                             #   - overall selected collections
        rng = random.Random()                   #   - per-group selection details and resons for skipping collections/groups

    max_global = config.rotation.max_collections
    remaining_global = max_global

    selected: List[str] = []
    selected_set: Set[str] = set()
    group_results: List[GroupSelectionResult] = []

    # Groups are considered in the order they appear in config.yaml
    logger.info("Starting dry rotation for %d groups", len(config.groups))
    for group in config.groups:
        is_active = _group_is_active(group, today)

        result = GroupSelectionResult(
            group_name=group.name,
            active=is_active,
            min_picks=group.min_picks,
            max_picks=group.max_picks,
            available_collections=list(group.collections),
            chosen_collections=[],
            picked_count=0,
            reason_skipped=None,
        )

        if not is_active:
            result.reason_skipped = "Group disabled or outside date_range"
            group_results.append(result)
            continue

        if remaining_global <= 0:
            result.reason_skipped = (
                "Global max_collections reached before this group was processed"
            )
            group_results.append(result)
            continue

        # Remove any collections already chosen by earlier groups
        available = [c for c in group.collections if c not in selected_set]
        result.available_collections = available

        if not available:
            result.reason_skipped = (
                "No available collections (all already selected by other groups)"
            )
            group_results.append(result)
            continue

        # Determine how many collection *could* be picked from this group
        max_for_group = min(
            group.max_picks,
            remaining_global,
            len(available),
        )

        if max_for_group <= 0:
            result.reason_skipped = (
                "max_picks for this group or global cap prevented any selection"
            )
            group_results.append(result)
            continue

        min_for_group = min(group.min_picks, max_for_group)

        # If min == max, it's fixed. Otherwise pick a random number in range.
        if min_for_group == max_for_group:
            k = max_for_group
        else:
            k = rng.randint(min_for_group, max_for_group)

        if k <= 0:
            result.reason_skipped = "Randomly chose to pick 0 from this group"
            group_results.append(result)
            continue

        chosen = rng.sample(available, k=k)

        selected.extend(chosen)
        selected_set.update(chosen)
        remaining_global -= k

        result.chosen_collections = chosen
        result.picked_count = k

        group_results.append(result)

        if remaining_global <= 0:
            break

    rotation_result = RotationResult(
        selected_collections=selected,
        groups=group_results,
        max_global=max_global,
        remaining_global=remaining_global,
        today=today,
    )

    logger.info(
        "Dry rotation complete: %d selected, %d remaining",
        len(selected),
        remaining_global,
    )
    logger.debug("Group selection details: %s", group_results)

    return rotation_result


# Just returns the list of selected collections
def select_collections_for_rotation(
    config: AppConfig,
    *,
    today: Optional[date] = None,
    rng: Optional[random.Random] = None,
) -> List[str]:
    result = run_rotation_dry(config, today=today, rng=rng)
    return result.selected_collections


def build_collection_visibility_map(config: AppConfig) -> Dict[str, Dict[str, bool]]:
    """
    Build a mapping from collection name to visibility settings based on the group it belongs to.

    If a collection appears in multiple groups, the first group's visibility settings are used.

    Returns:
        Dict mapping collection name to visibility settings dict with keys: home, shared, recommended
        e.g. {"Christmas Classics": {"home": True, "shared": True, "recommended": False}}
    """
    visibility_map: Dict[str, Dict[str, bool]] = {}

    for group in config.groups:
        for collection_name in group.collections:
            # Only set visibility if this collection hasn't been seen yet
            # (first group wins if a collection is in multiple groups)
            if collection_name not in visibility_map:
                visibility_map[collection_name] = {
                    "home": group.visibility_home,
                    "shared": group.visibility_shared,
                    "recommended": group.visibility_recommended,
                }

    return visibility_map
