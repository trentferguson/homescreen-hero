"""
Tests for configuration schema and validation
"""
import pytest
from pydantic import ValidationError
from homescreen_hero.core.config.schema import (
    DateRange,
    PlexLibraryConfig,
    PlexSettings,
    RotationSettings,
    CollectionGroupConfig,
    AppConfig,
)


class TestDateRange:
    """Tests for DateRange model"""

    def test_valid_date_range(self):
        dr = DateRange(start="12-01", end="12-31")
        assert dr.start == "12-01"
        assert dr.end == "12-31"

    def test_requires_start_and_end(self):
        with pytest.raises(ValidationError):
            DateRange(start="12-01")


class TestPlexLibraryConfig:
    """Tests for PlexLibraryConfig model"""

    def test_valid_library(self):
        lib = PlexLibraryConfig(name="Movies", enabled=True)
        assert lib.name == "Movies"
        assert lib.enabled is True

    def test_default_enabled(self):
        lib = PlexLibraryConfig(name="Movies")
        assert lib.enabled is True

    def test_requires_name(self):
        with pytest.raises(ValidationError):
            PlexLibraryConfig()


class TestPlexSettings:
    """Tests for PlexSettings model"""

    def test_valid_plex_settings(self):
        plex = PlexSettings(
            base_url="http://localhost:32400",
            token="test-token",
            libraries=[PlexLibraryConfig(name="Movies")]
        )
        assert plex.base_url == "http://localhost:32400"
        assert plex.token == "test-token"
        assert len(plex.libraries) == 1

    def test_optional_token(self):
        plex = PlexSettings(base_url="http://localhost:32400")
        assert plex.token is None

    def test_empty_libraries_list(self):
        plex = PlexSettings(base_url="http://localhost:32400")
        assert plex.libraries == []


class TestRotationSettings:
    """Tests for RotationSettings model"""

    def test_default_values(self):
        rotation = RotationSettings()
        assert rotation.enabled is True
        assert rotation.interval_hours == 12
        assert rotation.max_collections == 5
        assert rotation.group_order == "display_order"
        assert rotation.allow_repeats is False
        assert rotation.sync_all_on_rotation is True

    def test_custom_values(self):
        rotation = RotationSettings(
            enabled=False,
            interval_hours=24,
            max_collections=10,
            group_order="weighted",
            allow_repeats=True,
            sync_all_on_rotation=False
        )
        assert rotation.enabled is False
        assert rotation.interval_hours == 24
        assert rotation.max_collections == 10
        assert rotation.group_order == "weighted"
        assert rotation.allow_repeats is True
        assert rotation.sync_all_on_rotation is False

    def test_interval_hours_minimum(self):
        with pytest.raises(ValidationError):
            RotationSettings(interval_hours=0)

    def test_max_collections_minimum(self):
        with pytest.raises(ValidationError):
            RotationSettings(max_collections=0)

    def test_migrates_legacy_strategy_weighted(self):
        rotation = RotationSettings.model_validate({"strategy": "weighted"})
        assert rotation.group_order == "weighted"

    def test_migrates_legacy_strategy_lru_to_display_order(self):
        rotation = RotationSettings.model_validate({"strategy": "lru"})
        assert rotation.group_order == "display_order"


class TestCollectionGroupConfig:
    """Tests for CollectionGroupConfig model"""

    def test_valid_group(self):
        group = CollectionGroupConfig(
            name="Action",
            enabled=True,
            min_picks=1,
            max_picks=3,
            weight=2,
            min_gap_rotations=5,
            collections=["Action Movies", "Superhero Collection"]
        )
        assert group.name == "Action"
        assert group.enabled is True
        assert group.min_picks == 1
        assert group.max_picks == 3
        assert group.weight == 2
        assert group.min_gap_rotations == 5
        assert len(group.collections) == 2

    def test_default_values(self):
        group = CollectionGroupConfig(
            name="Test",
            collections=["Test Collection"]
        )
        assert group.enabled is True
        assert group.min_picks == 0
        assert group.max_picks == 1
        assert group.weight == 1
        assert group.min_gap_rotations == 0

    def test_with_date_range(self):
        group = CollectionGroupConfig(
            name="Christmas",
            date_range=DateRange(start="12-01", end="12-26"),
            collections=["Christmas Movies"]
        )
        assert group.date_range is not None
        assert group.date_range.start == "12-01"

    def test_collection_selection_defaults_to_random(self):
        group = CollectionGroupConfig(name="Test", collections=["Test Collection"])
        assert group.collection_selection == "random"

    def test_collection_selection_null_migrates_to_random(self):
        group = CollectionGroupConfig(name="Test", collection_selection=None, collections=["Test Collection"])
        assert group.collection_selection == "random"

    def test_requires_name(self):
        with pytest.raises(ValidationError):
            CollectionGroupConfig(collections=["Test Collection"])


class TestAppConfig:
    """Tests for complete AppConfig"""

    def test_valid_app_config(self):
        config = AppConfig(
            plex=PlexSettings(
                base_url="http://localhost:32400",
                token="test-token",
                libraries=[PlexLibraryConfig(name="Movies")]
            ),
            rotation=RotationSettings(),
            groups=[
                CollectionGroupConfig(
                    name="Action",
                    collections=["Action Movies"]
                )
            ]
        )
        assert config.plex.base_url == "http://localhost:32400"
        assert len(config.groups) == 1
        assert config.rotation.enabled is True

    def test_minimal_app_config(self):
        config = AppConfig(
            plex=PlexSettings(base_url="http://localhost:32400"),
            rotation=RotationSettings(),
            groups=[]
        )
        assert config.rotation is not None
        assert config.groups == []

    def test_requires_plex_settings(self):
        with pytest.raises(ValidationError):
            AppConfig()
