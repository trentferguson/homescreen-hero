"""
Tests for rotation logic
"""
import pytest
from datetime import date
import random
from homescreen_hero.core.rotation import (
    _parse_month_day,
    _is_date_in_range,
    _group_is_active,
    _passes_gap_rule,
    _is_blacklisted,
    _get_ordered_groups,
    _select_collections_from_group,
)
from homescreen_hero.core.config.schema import CollectionGroupConfig, DateRange


# Mock CollectionUsage for testing
class MockCollectionUsage:
    def __init__(self, collection_name, last_rotation_id):
        self.collection_name = collection_name
        self.last_rotation_id = last_rotation_id


class TestParseMonthDay:
    """Tests for _parse_month_day function"""

    def test_valid_date(self):
        month, day = _parse_month_day("12-25")
        assert month == 12
        assert day == 25

    def test_single_digit_month_day(self):
        month, day = _parse_month_day("1-5")
        assert month == 1
        assert day == 5

    def test_invalid_format(self):
        with pytest.raises(ValueError, match="Invalid MM-DD date format"):
            _parse_month_day("invalid")

    def test_month_out_of_range(self):
        with pytest.raises(ValueError, match="Month out of range"):
            _parse_month_day("13-01")

    def test_day_out_of_range(self):
        with pytest.raises(ValueError, match="Day out of range"):
            _parse_month_day("12-32")


class TestIsDateInRange:
    """Tests for _is_date_in_range function"""

    def test_date_within_same_year_range(self):
        # December 1 to December 31
        dr = DateRange(start="12-01", end="12-31")
        assert _is_date_in_range(date(2024, 12, 15), dr) is True
        assert _is_date_in_range(date(2024, 12, 1), dr) is True
        assert _is_date_in_range(date(2024, 12, 31), dr) is True
        assert _is_date_in_range(date(2024, 11, 30), dr) is False
        assert _is_date_in_range(date(2024, 1, 1), dr) is False

    def test_date_wrapping_year_boundary(self):
        # November 20 to January 10 (wraps around year)
        dr = DateRange(start="11-20", end="01-10")
        assert _is_date_in_range(date(2024, 12, 15), dr) is True
        assert _is_date_in_range(date(2024, 11, 20), dr) is True
        assert _is_date_in_range(date(2024, 1, 10), dr) is True
        assert _is_date_in_range(date(2024, 11, 19), dr) is False
        assert _is_date_in_range(date(2024, 1, 11), dr) is False
        assert _is_date_in_range(date(2024, 6, 15), dr) is False


class TestGroupIsActive:
    """Tests for _group_is_active function"""

    def test_disabled_group(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=False,
            collections=["Test Collection"]
        )
        assert _group_is_active(group, date(2024, 12, 15)) is False

    def test_enabled_group_no_date_range(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            collections=["Test Collection"]
        )
        assert _group_is_active(group, date(2024, 12, 15)) is True

    def test_enabled_group_within_date_range(self):
        group = CollectionGroupConfig(
            name="Christmas",
            enabled=True,
            date_range=DateRange(start="12-01", end="12-26"),
            collections=["Christmas Movies"]
        )
        assert _group_is_active(group, date(2024, 12, 15)) is True
        assert _group_is_active(group, date(2024, 12, 1)) is True
        assert _group_is_active(group, date(2024, 11, 30)) is False

    def test_enabled_group_outside_date_range(self):
        group = CollectionGroupConfig(
            name="Summer",
            enabled=True,
            date_range=DateRange(start="06-01", end="08-31"),
            collections=["Summer Blockbusters"]
        )
        assert _group_is_active(group, date(2024, 7, 15)) is True
        assert _group_is_active(group, date(2024, 12, 15)) is False


class TestPassesGapRule:
    """Tests for _passes_gap_rule function"""

    def test_no_gap_requirement(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            min_gap_rotations=0,
            collections=["Test Collection"]
        )
        usage_map = {
            "Test Collection": MockCollectionUsage("Test Collection", 5)
        }
        assert _passes_gap_rule("Test Collection", group, max_rotation_id=6, usage_map=usage_map) is True

    def test_no_previous_rotations(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            min_gap_rotations=3,
            collections=["Test Collection"]
        )
        assert _passes_gap_rule("Test Collection", group, max_rotation_id=0, usage_map={}) is True

    def test_never_used_before(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            min_gap_rotations=3,
            collections=["New Collection"]
        )
        usage_map = {
            "Other Collection": MockCollectionUsage("Other Collection", 5)
        }
        assert _passes_gap_rule("New Collection", group, max_rotation_id=10, usage_map=usage_map) is True

    def test_gap_requirement_not_met(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            min_gap_rotations=5,
            collections=["Test Collection"]
        )
        usage_map = {
            "Test Collection": MockCollectionUsage("Test Collection", 8)
        }
        # Current rotation is 10, last used at 8, gap is 2 (needs 5)
        assert _passes_gap_rule("Test Collection", group, max_rotation_id=10, usage_map=usage_map) is False

    def test_gap_requirement_met(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            min_gap_rotations=5,
            collections=["Test Collection"]
        )
        usage_map = {
            "Test Collection": MockCollectionUsage("Test Collection", 5)
        }
        # Current rotation is 11, last used at 5, gap is 6 (needs 5)
        assert _passes_gap_rule("Test Collection", group, max_rotation_id=11, usage_map=usage_map) is True

    def test_gap_requirement_exactly_met(self):
        group = CollectionGroupConfig(
            name="Test",
            enabled=True,
            min_gap_rotations=3,
            collections=["Test Collection"]
        )
        usage_map = {
            "Test Collection": MockCollectionUsage("Test Collection", 7)
        }
        # Current rotation is 10, last used at 7, gap is exactly 3
        assert _passes_gap_rule("Test Collection", group, max_rotation_id=10, usage_map=usage_map) is True


class TestIsBlacklisted:
    """Tests for _is_blacklisted function"""

    def test_collection_not_blacklisted_empty_list(self):
        assert _is_blacklisted("Collection A", []) is False

    def test_collection_blacklisted(self):
        blacklist = ["Collection A", "Collection B"]
        assert _is_blacklisted("Collection A", blacklist) is True
        assert _is_blacklisted("Collection B", blacklist) is True

    def test_collection_not_in_blacklist(self):
        blacklist = ["Collection A", "Collection B"]
        assert _is_blacklisted("Collection C", blacklist) is False

    def test_case_sensitive_matching(self):
        blacklist = ["Collection A"]
        assert _is_blacklisted("Collection A", blacklist) is True
        assert _is_blacklisted("collection a", blacklist) is False
        assert _is_blacklisted("COLLECTION A", blacklist) is False


class TestGetOrderedGroups:
    """Tests for _get_ordered_groups function"""

    def test_random_strategy_preserves_order(self):
        """Random strategy should preserve original config order"""
        groups = [
            CollectionGroupConfig(
                name="Group A",
                enabled=True,
                weight=5,
                collections=["Collection A"]
            ),
            CollectionGroupConfig(
                name="Group B",
                enabled=True,
                weight=10,
                collections=["Collection B"]
            ),
            CollectionGroupConfig(
                name="Group C",
                enabled=True,
                weight=1,
                collections=["Collection C"]
            ),
        ]
        rng = random.Random(42)
        ordered = _get_ordered_groups(groups, "random", rng)

        # Order should be preserved
        assert ordered[0].name == "Group A"
        assert ordered[1].name == "Group B"
        assert ordered[2].name == "Group C"

    def test_weighted_strategy_sorts_by_weight(self):
        """Weighted strategy should sort groups by weight (descending)"""
        groups = [
            CollectionGroupConfig(
                name="Group A",
                enabled=True,
                weight=5,
                collections=["Collection A"]
            ),
            CollectionGroupConfig(
                name="Group B",
                enabled=True,
                weight=10,
                collections=["Collection B"]
            ),
            CollectionGroupConfig(
                name="Group C",
                enabled=True,
                weight=1,
                collections=["Collection C"]
            ),
        ]
        rng = random.Random(42)
        ordered = _get_ordered_groups(groups, "weighted", rng)

        # Should be sorted by weight descending: B(10), A(5), C(1)
        assert ordered[0].name == "Group B"
        assert ordered[0].weight == 10
        assert ordered[1].name == "Group A"
        assert ordered[1].weight == 5
        assert ordered[2].name == "Group C"
        assert ordered[2].weight == 1

    def test_weighted_strategy_with_equal_weights(self):
        """Weighted strategy should preserve config order for groups with same weight"""
        groups = [
            CollectionGroupConfig(
                name="Group A",
                enabled=True,
                weight=5,
                collections=["Collection A"]
            ),
            CollectionGroupConfig(
                name="Group B",
                enabled=True,
                weight=5,
                collections=["Collection B"]
            ),
            CollectionGroupConfig(
                name="Group C",
                enabled=True,
                weight=5,
                collections=["Collection C"]
            ),
        ]
        rng = random.Random(42)
        ordered = _get_ordered_groups(groups, "weighted", rng)

        # All have same weight, should preserve original order
        assert ordered[0].name == "Group A"
        assert ordered[1].name == "Group B"
        assert ordered[2].name == "Group C"

    def test_weighted_strategy_mixed_weights(self):
        """Weighted strategy with mixed weights including duplicates"""
        groups = [
            CollectionGroupConfig(
                name="Group A",
                enabled=True,
                weight=3,
                collections=["Collection A"]
            ),
            CollectionGroupConfig(
                name="Group B",
                enabled=True,
                weight=10,
                collections=["Collection B"]
            ),
            CollectionGroupConfig(
                name="Group C",
                enabled=True,
                weight=3,
                collections=["Collection C"]
            ),
            CollectionGroupConfig(
                name="Group D",
                enabled=True,
                weight=7,
                collections=["Collection D"]
            ),
        ]
        rng = random.Random(42)
        ordered = _get_ordered_groups(groups, "weighted", rng)

        # Should be: B(10), D(7), A(3), C(3) - A before C due to config order
        assert ordered[0].name == "Group B"
        assert ordered[1].name == "Group D"
        assert ordered[2].name == "Group A"
        assert ordered[3].name == "Group C"


class TestSelectCollectionsFromGroup:
    """Tests for _select_collections_from_group function"""

    def test_random_strategy_uses_random_sample(self):
        """Random strategy should use random sampling"""
        available = ["Collection A", "Collection B", "Collection C", "Collection D"]
        usage_map = {}
        rng = random.Random(42)

        chosen = _select_collections_from_group(available, 2, "random", usage_map, rng)

        assert len(chosen) == 2
        assert all(c in available for c in chosen)

    def test_lru_strategy_prioritizes_never_used(self):
        """LRU strategy should prioritize collections never used"""
        available = ["Never Used", "Used Recently", "Used Long Ago"]
        usage_map = {
            "Used Recently": MockCollectionUsage("Used Recently", 10),
            "Used Long Ago": MockCollectionUsage("Used Long Ago", 5),
            # "Never Used" not in usage_map
        }
        rng = random.Random(42)

        chosen = _select_collections_from_group(available, 2, "lru", usage_map, rng)

        # Should pick "Never Used" first, then "Used Long Ago" (older rotation ID)
        assert chosen[0] == "Never Used"
        assert chosen[1] == "Used Long Ago"

    def test_lru_strategy_orders_by_rotation_id(self):
        """LRU strategy should order by last_rotation_id ascending"""
        available = ["Recent 1", "Old 1", "Recent 2", "Old 2"]
        usage_map = {
            "Recent 1": MockCollectionUsage("Recent 1", 20),
            "Old 1": MockCollectionUsage("Old 1", 5),
            "Recent 2": MockCollectionUsage("Recent 2", 15),
            "Old 2": MockCollectionUsage("Old 2", 8),
        }
        rng = random.Random(42)

        chosen = _select_collections_from_group(available, 3, "lru", usage_map, rng)

        # Should be ordered by rotation ID: Old 1 (5), Old 2 (8), Recent 2 (15)
        assert chosen == ["Old 1", "Old 2", "Recent 2"]

    def test_lru_strategy_all_never_used(self):
        """LRU strategy with all collections never used"""
        available = ["A", "B", "C", "D"]
        usage_map = {}
        rng = random.Random(42)

        chosen = _select_collections_from_group(available, 2, "lru", usage_map, rng)

        # All have same priority (never used), should take first k from sorted
        assert len(chosen) == 2
        assert all(c in available for c in chosen)

    def test_lru_strategy_respects_k_parameter(self):
        """LRU strategy should respect the k parameter"""
        available = ["A", "B", "C", "D", "E"]
        usage_map = {
            "A": MockCollectionUsage("A", 1),
            "B": MockCollectionUsage("B", 2),
            "C": MockCollectionUsage("C", 3),
            "D": MockCollectionUsage("D", 4),
            "E": MockCollectionUsage("E", 5),
        }
        rng = random.Random(42)

        # Request only 3 collections
        chosen = _select_collections_from_group(available, 3, "lru", usage_map, rng)

        # Should get oldest 3: A(1), B(2), C(3)
        assert chosen == ["A", "B", "C"]
