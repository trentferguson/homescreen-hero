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
    run_rotation_with_history,
    run_auto_rotation_with_history,
)
from homescreen_hero.core.config.schema import (
    AppConfig,
    CollectionGroupConfig,
    DateRange,
    PlexSettings,
    PlexLibraryConfig,
    RotationSettings,
)


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


# Helper to create minimal AppConfig for testing
def _make_test_config(
    groups: list,
    max_collections: int = 10,
    per_library_limits: dict = None,
    strategy: str = "random",
    allow_repeats: bool = True,
    blacklisted_collections: list = None,
) -> AppConfig:
    return AppConfig(
        plex=PlexSettings(
            base_url="http://localhost:32400",
            token="test-token",
            libraries=[
                PlexLibraryConfig(name="Movies", enabled=True),
                PlexLibraryConfig(name="TV Shows", enabled=True),
            ],
        ),
        groups=groups,
        rotation=RotationSettings(
            enabled=True,
            max_collections=max_collections,
            strategy=strategy,
            allow_repeats=allow_repeats,
            blacklisted_collections=blacklisted_collections or [],
            per_library_limits=per_library_limits or {},
        ),
    )


class TestPerLibraryLimits:
    """Tests for per-library collection limits in rotation"""

    def test_library_limit_enforced_within_group(self):
        """Library limit should restrict selections even when group has more collections"""
        groups = [
            CollectionGroupConfig(
                name="Movies Group",
                enabled=True,
                min_picks=5,
                max_picks=5,
                collections=["Movie A", "Movie B", "Movie C", "Movie D", "Movie E"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
            per_library_limits={"Movies": 2},  # Only allow 2 from Movies
        )
        # All collections are from Movies library
        collection_library_map = {
            "Movie A": "Movies",
            "Movie B": "Movies",
            "Movie C": "Movies",
            "Movie D": "Movies",
            "Movie E": "Movies",
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # Should only select 2 despite group wanting 5
        assert len(result.selected_collections) == 2
        assert result.per_library_counts["Movies"] == 2

    def test_library_limits_across_multiple_groups(self):
        """Library limits should be enforced across multiple groups"""
        groups = [
            CollectionGroupConfig(
                name="Group 1",
                enabled=True,
                min_picks=2,
                max_picks=2,
                collections=["Movie A", "Movie B"],
            ),
            CollectionGroupConfig(
                name="Group 2",
                enabled=True,
                min_picks=2,
                max_picks=2,
                collections=["Movie C", "Movie D"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
            per_library_limits={"Movies": 3},  # Only allow 3 total from Movies
        )
        collection_library_map = {
            "Movie A": "Movies",
            "Movie B": "Movies",
            "Movie C": "Movies",
            "Movie D": "Movies",
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # Should select 3 total (2 from first group, 1 from second)
        assert len(result.selected_collections) == 3
        assert result.per_library_counts["Movies"] == 3

    def test_no_limit_for_library_allows_unlimited(self):
        """Collections from a library with no limit should be unrestricted"""
        groups = [
            CollectionGroupConfig(
                name="Mixed Group",
                enabled=True,
                min_picks=5,
                max_picks=5,
                collections=["Movie A", "Movie B", "TV A", "TV B", "TV C"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
            per_library_limits={"Movies": 1},  # Only limit Movies, not TV Shows
        )
        collection_library_map = {
            "Movie A": "Movies",
            "Movie B": "Movies",
            "TV A": "TV Shows",
            "TV B": "TV Shows",
            "TV C": "TV Shows",
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # 1 Movie (limited) + 3 TV Shows (all available, no limit) = 4 total
        assert len(result.selected_collections) == 4
        assert result.per_library_counts["Movies"] == 1
        assert result.per_library_counts["TV Shows"] == 3

    def test_unknown_library_collections_allowed(self):
        """Collections not in the library map should be allowed"""
        groups = [
            CollectionGroupConfig(
                name="Mixed Group",
                enabled=True,
                min_picks=3,
                max_picks=3,
                collections=["Known Movie", "Unknown Collection", "Another Unknown"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
            per_library_limits={"Movies": 1},
        )
        # Only one collection has a known library
        collection_library_map = {
            "Known Movie": "Movies",
            # "Unknown Collection" and "Another Unknown" not in map
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # Should select all 3 (1 Movie limited, 2 unknown allowed)
        assert len(result.selected_collections) == 3
        assert result.per_library_counts.get("Movies", 0) <= 1

    def test_empty_per_library_limits_allows_all(self):
        """Empty per_library_limits should not restrict any selections"""
        groups = [
            CollectionGroupConfig(
                name="Big Group",
                enabled=True,
                min_picks=5,
                max_picks=5,
                collections=["A", "B", "C", "D", "E"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
            per_library_limits={},  # No limits
        )
        collection_library_map = {
            "A": "Movies",
            "B": "Movies",
            "C": "Movies",
            "D": "Movies",
            "E": "Movies",
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # Should select all 5 with no limits
        assert len(result.selected_collections) == 5

    def test_library_limit_zero_blocks_all(self):
        """A library limit of 0 should block all collections from that library"""
        groups = [
            CollectionGroupConfig(
                name="Movies Group",
                enabled=True,
                min_picks=3,
                max_picks=3,
                collections=["Movie A", "Movie B", "Movie C"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
            per_library_limits={"Movies": 0},  # Block all Movies
        )
        collection_library_map = {
            "Movie A": "Movies",
            "Movie B": "Movies",
            "Movie C": "Movies",
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # No collections should be selected
        assert len(result.selected_collections) == 0
        assert result.per_library_counts.get("Movies", 0) == 0

    def test_per_library_counts_tracked_in_result(self):
        """RotationResult should include per_library_counts"""
        groups = [
            CollectionGroupConfig(
                name="Mixed",
                enabled=True,
                min_picks=4,
                max_picks=4,
                collections=["Movie A", "Movie B", "TV A", "TV B"],
            ),
        ]
        config = _make_test_config(
            groups=groups,
            max_collections=10,
        )
        collection_library_map = {
            "Movie A": "Movies",
            "Movie B": "Movies",
            "TV A": "TV Shows",
            "TV B": "TV Shows",
        }

        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            rng=random.Random(42),
        )

        # Result should track counts per library
        assert "Movies" in result.per_library_counts or "TV Shows" in result.per_library_counts
        total_tracked = sum(result.per_library_counts.values())
        assert total_tracked == 4


class TestAutoRotationPerLibraryLimits:
    """Tests for per-library limits in auto-rotation mode"""

    def test_auto_rotation_library_limit_enforced(self):
        """Auto-rotation should respect per-library limits"""
        all_collections = ["Movie A", "Movie B", "Movie C", "TV A", "TV B"]
        collection_library_map = {
            "Movie A": "Movies",
            "Movie B": "Movies",
            "Movie C": "Movies",
            "TV A": "TV Shows",
            "TV B": "TV Shows",
        }

        result = run_auto_rotation_with_history(
            all_collections,
            max_collections=5,
            strategy="random",
            blacklisted_collections=[],
            allow_repeats=True,
            last_rotation_collections=[],
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            per_library_limits={"Movies": 2, "TV Shows": 1},
            rng=random.Random(42),
        )

        # Should respect limits: max 2 Movies + max 1 TV Show = 3 total
        assert len(result.selected_collections) == 3
        assert result.per_library_counts.get("Movies", 0) <= 2
        assert result.per_library_counts.get("TV Shows", 0) <= 1

    def test_auto_rotation_no_limits(self):
        """Auto-rotation without limits should select up to max_collections"""
        all_collections = ["A", "B", "C", "D", "E"]
        collection_library_map = {c: "Movies" for c in all_collections}

        result = run_auto_rotation_with_history(
            all_collections,
            max_collections=5,
            strategy="random",
            blacklisted_collections=[],
            allow_repeats=True,
            last_rotation_collections=[],
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            per_library_limits={},  # No limits
            rng=random.Random(42),
        )

        assert len(result.selected_collections) == 5

    def test_auto_rotation_iterative_selection(self):
        """Auto-rotation with limits should use iterative selection"""
        all_collections = ["M1", "M2", "M3", "M4", "T1", "T2"]
        collection_library_map = {
            "M1": "Movies", "M2": "Movies", "M3": "Movies", "M4": "Movies",
            "T1": "TV Shows", "T2": "TV Shows",
        }

        result = run_auto_rotation_with_history(
            all_collections,
            max_collections=4,
            strategy="random",
            blacklisted_collections=[],
            allow_repeats=True,
            last_rotation_collections=[],
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            per_library_limits={"Movies": 2, "TV Shows": 2},
            rng=random.Random(42),
        )

        # Should select 4 total, respecting both limits
        assert len(result.selected_collections) == 4
        assert result.per_library_counts.get("Movies", 0) <= 2
        assert result.per_library_counts.get("TV Shows", 0) <= 2

    def test_auto_rotation_unknown_collections_allowed(self):
        """Auto-rotation should allow collections not in library map"""
        all_collections = ["Known", "Unknown1", "Unknown2"]
        collection_library_map = {"Known": "Movies"}

        result = run_auto_rotation_with_history(
            all_collections,
            max_collections=3,
            strategy="random",
            blacklisted_collections=[],
            allow_repeats=True,
            last_rotation_collections=[],
            max_rotation_id=0,
            usage_map={},
            collection_library_map=collection_library_map,
            per_library_limits={"Movies": 1},
            rng=random.Random(42),
        )

        # Should select all 3 (1 from Movies, 2 unknown)
        assert len(result.selected_collections) == 3
