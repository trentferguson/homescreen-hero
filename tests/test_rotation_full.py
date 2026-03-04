"""
Tests for complete rotation scenarios
"""
import pytest
from datetime import date
import random
from homescreen_hero.core.rotation import run_rotation_with_history
from homescreen_hero.core.config.schema import (
    AppConfig,
    PlexSettings,
    RotationSettings,
    CollectionGroupConfig,
    DateRange,
)


# Mock CollectionUsage for testing
class MockCollectionUsage:
    def __init__(self, collection_name, last_rotation_id):
        self.collection_name = collection_name
        self.last_rotation_id = last_rotation_id


class TestRunRotationWithHistory:
    """Tests for full rotation scenarios"""

    def test_basic_rotation_single_group(self):
        """Test basic rotation with a single group"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=3,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Action",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Action 1", "Action 2", "Action 3"]
                )
            ]
        )

        # Use fixed seed for reproducible results
        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        assert len(result.selected_collections) > 0
        assert len(result.selected_collections) <= 3  # max_collections
        assert len(result.groups) == 1
        assert result.groups[0].active is True

    def test_multiple_groups_respects_global_max(self):
        """Test that multiple groups respect global max_collections"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=3,  # Global max
            ),
            groups=[
                CollectionGroupConfig(
                    name="Action",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Action 1", "Action 2"]
                ),
                CollectionGroupConfig(
                    name="Comedy",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Comedy 1", "Comedy 2"]
                ),
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # Should not exceed global max
        assert len(result.selected_collections) <= 3
        assert len(result.groups) == 2

    def test_gap_rule_prevents_recent_collections(self):
        """Test that gap rule prevents recently used collections"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=2,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Action",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    min_gap_rotations=3,  # Must wait 3 rotations
                    collections=["Action 1", "Action 2", "Action 3"]
                )
            ]
        )

        # Simulate that "Action 1" was used in rotation 5
        usage_map = {
            "Action 1": MockCollectionUsage("Action 1", 5)
        }

        # Current rotation is 6, gap is only 1 (needs 3)
        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=6,
            usage_map=usage_map,
            today=date(2024, 12, 15),
            rng=rng
        )

        # Action 1 should not be selected due to gap rule
        assert "Action 1" not in result.selected_collections

    def test_inactive_group_skipped(self):
        """Test that inactive groups are skipped"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=5,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Christmas",
                    enabled=True,
                    date_range=DateRange(start="12-01", end="12-26"),
                    min_picks=1,
                    max_picks=2,
                    collections=["Christmas 1", "Christmas 2"]
                ),
                CollectionGroupConfig(
                    name="Summer",
                    enabled=True,
                    date_range=DateRange(start="06-01", end="08-31"),
                    min_picks=1,
                    max_picks=2,
                    collections=["Summer 1", "Summer 2"]
                ),
            ]
        )

        # Test in December - Christmas active, Summer inactive
        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # Should have Christmas collections, not Summer
        assert len(result.groups) == 2
        christmas_result = next(r for r in result.groups if r.group_name == "Christmas")
        summer_result = next(r for r in result.groups if r.group_name == "Summer")

        assert christmas_result.active is True
        assert summer_result.active is False
        assert summer_result.reason_skipped is not None

    def test_disabled_group_skipped(self):
        """Test that disabled groups are skipped"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=5,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Enabled",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Movie 1", "Movie 2"]
                ),
                CollectionGroupConfig(
                    name="Disabled",
                    enabled=False,
                    min_picks=1,
                    max_picks=2,
                    collections=["Movie 3", "Movie 4"]
                ),
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        disabled_result = next(r for r in result.groups if r.group_name == "Disabled")
        assert disabled_result.active is False
        assert "Movie 3" not in result.selected_collections
        assert "Movie 4" not in result.selected_collections

    def test_min_picks_requirement(self):
        """Test that min_picks is respected when possible"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=10,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Action",
                    enabled=True,
                    min_picks=2,  # Require at least 2
                    max_picks=3,
                    collections=["Action 1", "Action 2", "Action 3", "Action 4"]
                )
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        action_result = result.groups[0]
        # Should pick at least min_picks
        assert action_result.picked_count >= 2

    def test_empty_group_collections(self):
        """Test handling of groups with no collections"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=5,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Empty",
                    enabled=True,
                    min_picks=0,
                    max_picks=2,
                    collections=[]
                )
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # Should handle empty collections gracefully
        assert len(result.selected_collections) == 0
        assert result.groups[0].reason_skipped is not None

    def test_no_duplicate_collections_across_groups(self):
        """Test that same collection in multiple groups is only selected once"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=10,
            ),
            groups=[
                CollectionGroupConfig(
                    name="Group1",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Shared Movie", "Movie 1"]
                ),
                CollectionGroupConfig(
                    name="Group2",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Shared Movie", "Movie 2"]
                ),
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # "Shared Movie" should only appear once
        assert result.selected_collections.count("Shared Movie") <= 1

    def test_blacklisted_collections_never_selected(self):
        """Test that blacklisted collections are filtered from all groups"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=5,
                blacklisted_collections=["Blocked Movie", "Another Blocked"]
            ),
            groups=[
                CollectionGroupConfig(
                    name="Movies",
                    enabled=True,
                    min_picks=2,
                    max_picks=3,
                    collections=["Good Movie", "Blocked Movie", "Another Movie", "Another Blocked"]
                )
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # Blacklisted collections should never be selected
        assert "Blocked Movie" not in result.selected_collections
        assert "Another Blocked" not in result.selected_collections
        # Only non-blacklisted collections should be available
        for collection in result.selected_collections:
            assert collection in ["Good Movie", "Another Movie"]

    def test_blacklist_with_all_collections_blocked(self):
        """Test that group is skipped when all collections are blacklisted"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=5,
                blacklisted_collections=["Movie 1", "Movie 2"]
            ),
            groups=[
                CollectionGroupConfig(
                    name="Movies",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Movie 1", "Movie 2"]  # All blacklisted
                )
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # No collections should be selected
        assert len(result.selected_collections) == 0
        assert result.groups[0].reason_skipped is not None

    def test_blacklist_across_multiple_groups(self):
        """Test that blacklist applies across all groups"""
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(
                enabled=True,
                max_collections=10,
                blacklisted_collections=["Blocked Everywhere"]
            ),
            groups=[
                CollectionGroupConfig(
                    name="Action",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Action 1", "Blocked Everywhere"]
                ),
                CollectionGroupConfig(
                    name="Comedy",
                    enabled=True,
                    min_picks=1,
                    max_picks=2,
                    collections=["Comedy 1", "Blocked Everywhere"]
                ),
            ]
        )

        rng = random.Random(42)
        result = run_rotation_with_history(
            config,
            max_rotation_id=0,
            usage_map={},
            today=date(2024, 12, 15),
            rng=rng
        )

        # Blocked collection should not appear from any group
        assert "Blocked Everywhere" not in result.selected_collections
        # Other collections should still be selected
        assert len(result.selected_collections) >= 2
