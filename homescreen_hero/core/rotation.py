from __future__ import annotations

import logging
import random
from collections import defaultdict
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


def _get_ordered_groups(
    groups: List[CollectionGroupConfig],
    strategy: str,
    rng: random.Random,
) -> List[CollectionGroupConfig]:
    """
    Order groups based on the selection strategy.

    Args:
        groups: List of all groups from config
        strategy: Selection strategy ('random', 'weighted', or 'lru')
        rng: Random number generator for reproducibility

    Returns:
        Ordered list of groups to process
    """
    if strategy == "weighted":
        # Sort groups by weight (descending), then by config order for ties
        # Higher weight = processed first = higher priority
        logger.debug("Using weighted strategy: sorting groups by weight")
        return sorted(groups, key=lambda g: (-g.weight, groups.index(g)))
    else:
        # Default 'random' and 'lru' strategies: keep original config order
        # LRU strategy affects collection selection within groups, not group order
        logger.debug(f"Using {strategy} strategy: keeping original group order")
        return list(groups)


def _select_collections_from_group(
    available: List[str],
    k: int,
    strategy: str,
    usage_map: Dict[str, CollectionUsage],
    rng: random.Random,
) -> List[str]:
    """
    Select k collections from the available list based on strategy.

    Args:
        available: List of collection names to choose from
        k: Number of collections to select
        strategy: Selection strategy ('random', 'weighted', or 'lru')
        usage_map: Mapping of collection names to usage data
        rng: Random number generator for reproducibility

    Returns:
        List of selected collection names
    """
    if strategy == "lru":
        # Sort by last_rotation_id (ascending), prioritizing least recently used
        # Collections never used (None) are sorted first
        def sort_key(collection_name: str) -> Tuple[int, int]:
            usage = usage_map.get(collection_name)
            if usage is None or usage.last_rotation_id is None:
                # Never used - highest priority (sort first)
                return (0, 0)
            else:
                # Used before - sort by rotation ID (older = higher priority)
                # Secondary sort by times_used (less used = higher priority)
                return (1, usage.last_rotation_id)

        sorted_collections = sorted(available, key=sort_key)
        return sorted_collections[:k]
    else:
        # Default random selection
        return rng.sample(available, k=k)

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


def _is_blacklisted(collection_name: str, blacklist: List[str]) -> bool:
    # Check if collection is in the global blacklist
    return collection_name in blacklist


# Same as run_rotation_dry, but respects history for gap rules
def run_rotation_with_history(
    config: AppConfig,
    *,
    max_rotation_id: int,
    usage_map: Dict[str, CollectionUsage],
    last_rotation_collections: Optional[List[str]] = None,
    pinned_names: Optional[Set[str]] = None,
    collection_library_map: Optional[Dict[str, str]] = None,
    today: Optional[date] = None,
    rng: Optional[random.Random] = None,
) -> RotationResult:
    if today is None:
        today = date.today()
    if rng is None:
        rng = random.Random()

    max_global = config.rotation.max_collections
    remaining_global = max_global
    allow_repeats = config.rotation.allow_repeats
    last_rotation_set = set(last_rotation_collections or [])
    per_library_limits = config.rotation.per_library_limits
    collection_library_map = collection_library_map or {}

    selected: List[str] = []
    selected_set: Set[str] = set()
    group_results: List[GroupSelectionResult] = []
    library_counts: Dict[str, int] = defaultdict(int)

    # Helper to check if a collection is within its library's max limit
    def within_library_limit(coll_name: str) -> bool:
        if not per_library_limits:
            return True
        lib = collection_library_map.get(coll_name)
        if not lib:
            return True  # Unknown library, allow
        max_for_lib = per_library_limits.get(lib)
        if max_for_lib is None:
            return True  # No limit configured for this library
        return library_counts[lib] < max_for_lib

    # Handle pinned collections - they go first and don't count against max_collections
    pinned_names = pinned_names or set()
    blacklist = config.rotation.blacklisted_collections

    pinned_selected: List[str] = []
    for name in sorted(pinned_names):
        if name not in blacklist:
            pinned_selected.append(name)
            selected_set.add(name)

    if pinned_selected:
        logger.info(
            "Including %d pinned collections (not counted against max_collections): %s",
            len(pinned_selected),
            pinned_selected,
        )

    logger.info(
        "Starting rotation with history: %d max rotations observed", max_rotation_id
    )

    # Order groups based on strategy
    ordered_groups = _get_ordered_groups(config.groups, config.rotation.strategy, rng)

    for group in ordered_groups:
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

        # Filter out blacklisted collections
        blacklist = config.rotation.blacklisted_collections
        available = [c for c in available if not _is_blacklisted(c, blacklist)]

        # If allow_repeats is False, filter out collections from the last rotation
        if not allow_repeats and last_rotation_set:
            available = [c for c in available if c not in last_rotation_set]

        # Filter out collections that would exceed their library's max limit
        available = [c for c in available if within_library_limit(c)]

        result.available_collections = available

        if not available:
            result.reason_skipped = (
                "No available collections after applying gap rule, blacklist, and repeats filter"
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

        # Select collections based on strategy
        # When per-library limits are set, use iterative selection to respect limits
        if per_library_limits:
            chosen = []
            remaining_available = list(available)
            for _ in range(k):
                # Re-filter by library limit each iteration
                eligible = [c for c in remaining_available if within_library_limit(c)]
                if not eligible:
                    break
                pick = _select_collections_from_group(
                    eligible, 1, config.rotation.strategy, usage_map, rng
                )
                if not pick:
                    break
                coll = pick[0]
                chosen.append(coll)
                remaining_available.remove(coll)
                lib = collection_library_map.get(coll)
                if lib:
                    library_counts[lib] += 1
        else:
            chosen = _select_collections_from_group(
                available, k, config.rotation.strategy, usage_map, rng
            )
            # Update library counts for selected collections
            for coll in chosen:
                lib = collection_library_map.get(coll)
                if lib:
                    library_counts[lib] += 1

        selected.extend(chosen)
        selected_set.update(chosen)
        remaining_global -= len(chosen)

        result.chosen_collections = chosen
        result.picked_count = len(chosen)

        group_results.append(result)

        if remaining_global <= 0:
            break

    # Prepend pinned collections to ensure they're at the front
    final_selected = pinned_selected + selected

    rotation_result = RotationResult(
        selected_collections=final_selected,
        groups=group_results,
        max_global=max_global,
        remaining_global=remaining_global,
        today=today,
        per_library_counts=dict(library_counts),
    )

    logger.info(
            "Rotation complete with history: %d selected, %d remaining",
            len(selected),
            remaining_global,
        )
    if library_counts:
        logger.info("Per-library counts: %s", dict(library_counts))
    logger.debug("Group selection details: %s", group_results)

    return rotation_result


def run_auto_rotation_with_history(
    all_collections: List[str],
    *,
    max_collections: int,
    strategy: str,
    blacklisted_collections: List[str],
    allow_repeats: bool,
    last_rotation_collections: List[str],
    max_rotation_id: int,
    usage_map: Dict[str, CollectionUsage],
    pinned_names: Optional[Set[str]] = None,
    collection_library_map: Optional[Dict[str, str]] = None,
    per_library_limits: Optional[Dict[str, int]] = None,
    today: Optional[date] = None,
    rng: Optional[random.Random] = None,
) -> RotationResult:
    # Run rotation using all collections from a library instead of defined groups.
    # This is the "simple mode" for users who just want to rotate everything.
    if today is None:
        today = date.today()
    if rng is None:
        rng = random.Random()

    pinned_names = pinned_names or set()
    last_rotation_set = set(last_rotation_collections)
    collection_library_map = collection_library_map or {}
    per_library_limits = per_library_limits or {}
    library_counts: Dict[str, int] = defaultdict(int)

    # Handle pinned collections first - they don't count against max_collections
    pinned_selected: List[str] = []
    for name in sorted(pinned_names):
        if name not in blacklisted_collections and name in all_collections:
            pinned_selected.append(name)

    if pinned_selected:
        logger.info(
            "Auto-rotate: Including %d pinned collections: %s",
            len(pinned_selected),
            pinned_selected,
        )

    # Filter out blacklisted and already-pinned collections
    available = [
        c for c in all_collections
        if c not in blacklisted_collections and c not in pinned_selected
    ]

    # If allow_repeats is False, filter out collections from the last rotation
    if not allow_repeats and last_rotation_set:
        before_count = len(available)
        available = [c for c in available if c not in last_rotation_set]
        filtered_count = before_count - len(available)
        if filtered_count > 0:
            logger.info(
                "Auto-rotate: Filtered out %d collections from last rotation (allow_repeats=False)",
                filtered_count,
            )

    logger.info(
        "Auto-rotate: %d collections available after filtering (%d blacklisted, %d pinned%s)",
        len(available),
        len([c for c in all_collections if c in blacklisted_collections]),
        len(pinned_selected),
        ", repeats excluded" if not allow_repeats else "",
    )

    # Helper to check if a collection is within its library's max limit
    def within_library_limit(coll_name: str) -> bool:
        if not per_library_limits:
            return True
        lib = collection_library_map.get(coll_name)
        if not lib:
            return True
        max_for_lib = per_library_limits.get(lib)
        if max_for_lib is None:
            return True
        return library_counts[lib] < max_for_lib

    # Select collections using the configured strategy, respecting library limits
    # If per-library limits are set, we need to select iteratively
    selected: List[str] = []
    if per_library_limits:
        # Iterative selection to respect library limits
        remaining_available = list(available)
        while len(selected) < max_collections and remaining_available:
            # Filter by library limit
            eligible = [c for c in remaining_available if within_library_limit(c)]
            if not eligible:
                break
            # Select one collection
            chosen = _select_collections_from_group(eligible, 1, strategy, usage_map, rng)
            if not chosen:
                break
            coll = chosen[0]
            selected.append(coll)
            remaining_available.remove(coll)
            # Update library count
            lib = collection_library_map.get(coll)
            if lib:
                library_counts[lib] += 1
    else:
        # Simple selection without library limits
        k = min(max_collections, len(available))
        if k > 0:
            selected = _select_collections_from_group(
                available, k, strategy, usage_map, rng
            )
            # Track library counts for the result
            for coll in selected:
                lib = collection_library_map.get(coll)
                if lib:
                    library_counts[lib] += 1

    # Create a virtual group result for reporting
    group_result = GroupSelectionResult(
        group_name="All Collections (Auto-Rotate)",
        active=True,
        min_picks=0,
        max_picks=max_collections,
        available_collections=available,
        chosen_collections=selected,
        picked_count=len(selected),
        reason_skipped=None if selected else "No collections available after filtering",
    )

    # Prepend pinned collections
    final_selected = pinned_selected + selected

    rotation_result = RotationResult(
        selected_collections=final_selected,
        groups=[group_result],
        max_global=max_collections,
        remaining_global=max_collections - len(selected),
        today=today,
        per_library_counts=dict(library_counts),
    )

    logger.info(
        "Auto-rotate complete: %d selected (%d pinned + %d rotated)",
        len(final_selected),
        len(pinned_selected),
        len(selected),
    )

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

    # Groups are ordered based on strategy (weighted or random/config order)
    logger.info("Starting dry rotation for %d groups", len(config.groups))

    # Order groups based on strategy
    ordered_groups = _get_ordered_groups(config.groups, config.rotation.strategy, rng)

    # For dry run, we don't have usage history, so use empty map
    usage_map: Dict[str, CollectionUsage] = {}

    for group in ordered_groups:
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

        # Filter out blacklisted collections
        blacklist = config.rotation.blacklisted_collections
        available = [c for c in available if not _is_blacklisted(c, blacklist)]

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

        # Select collections based on strategy
        chosen = _select_collections_from_group(
            available, k, config.rotation.strategy, usage_map, rng
        )

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
