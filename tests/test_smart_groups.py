import pytest
from homescreen_hero.core.config.schema import SmartGroupRule
from homescreen_hero.core.smart_groups import (
    CollectionMetadata,
    _matches_rule,
    resolve_smart_rules,
    get_available_filter_options,
    build_collection_metadata,
)


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def sample_metadata():
    return [
        CollectionMetadata(
            name="Horror Classics",
            source="plex",
            library="Movies",
            labels=["horror", "classics"],
            item_count=25,
        ),
        CollectionMetadata(
            name="Marvel Collection",
            source="trakt",
            library="Movies",
            labels=["superhero", "action"],
            item_count=40,
        ),
        CollectionMetadata(
            name="Anime Favorites",
            source="anilist",
            library="Anime",
            labels=["anime"],
            item_count=15,
        ),
        CollectionMetadata(
            name="Stand-up Specials",
            source="plex",
            library="TV Shows",
            labels=[],
            item_count=8,
        ),
        CollectionMetadata(
            name="DC Universe",
            source="mdblist",
            library="Movies",
            labels=["superhero", "action", "dc"],
            item_count=30,
        ),
    ]


def _rule(field, operator, values):
    return SmartGroupRule(field=field, operator=operator, values=values)


# ── SmartGroupRule validation ─────────────────────────────────────────

class TestSmartGroupRuleValidation:

    def test_valid_rule(self):
        r = SmartGroupRule(field="label", operator="includes", values=["horror"])
        assert r.field == "label"
        assert r.operator == "includes"

    def test_invalid_operator_rejected(self):
        with pytest.raises(ValueError, match="Invalid operator"):
            SmartGroupRule(field="label", operator="is", values=["horror"])

    def test_invalid_field_rejected(self):
        with pytest.raises(ValueError):
            SmartGroupRule(field="rating", operator="gte", values=[8])


# ── Label rules ───────────────────────────────────────────────────────

class TestLabelRules:

    def test_label_includes_match(self, sample_metadata):
        rule = _rule("label", "includes", ["horror"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Horror Classics"]

    def test_label_includes_multiple_values_or(self, sample_metadata):
        # Multiple values are ORed — match collections with "horror" OR "anime"
        rule = _rule("label", "includes", ["horror", "anime"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Horror Classics", "Anime Favorites"}

    def test_label_includes_no_match(self, sample_metadata):
        rule = _rule("label", "includes", ["documentary"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == []

    def test_label_excludes(self, sample_metadata):
        rule = _rule("label", "excludes", ["superhero"])
        result = resolve_smart_rules([rule], sample_metadata)
        # Excludes Marvel and DC, keeps the rest
        assert "Marvel Collection" not in result
        assert "DC Universe" not in result
        assert "Horror Classics" in result

    def test_label_includes_case_insensitive(self, sample_metadata):
        rule = _rule("label", "includes", ["HORROR"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Horror Classics"]

    def test_label_includes_empty_labels_collection(self, sample_metadata):
        # Stand-up Specials has no labels — should not match any includes rule
        rule = _rule("label", "includes", ["standup"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert "Stand-up Specials" not in result

    def test_label_excludes_empty_labels_passes(self, sample_metadata):
        # Stand-up Specials has no labels — should pass excludes
        rule = _rule("label", "excludes", ["horror"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert "Stand-up Specials" in result


# ── Source rules ──────────────────────────────────────────────────────

class TestSourceRules:

    def test_source_is(self, sample_metadata):
        rule = _rule("source", "is", ["trakt"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Marvel Collection"]

    def test_source_is_multiple(self, sample_metadata):
        rule = _rule("source", "is", ["trakt", "mdblist"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Marvel Collection", "DC Universe"}

    def test_source_is_not(self, sample_metadata):
        rule = _rule("source", "is_not", ["plex"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert "Horror Classics" not in result
        assert "Stand-up Specials" not in result
        assert "Marvel Collection" in result

    def test_source_is_case_insensitive(self, sample_metadata):
        rule = _rule("source", "is", ["Trakt"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Marvel Collection"]


# ── Library rules ─────────────────────────────────────────────────────

class TestLibraryRules:

    def test_library_is(self, sample_metadata):
        rule = _rule("library", "is", ["Movies"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Horror Classics", "Marvel Collection", "DC Universe"}

    def test_library_is_not(self, sample_metadata):
        rule = _rule("library", "is_not", ["Movies"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Anime Favorites", "Stand-up Specials"}

    def test_library_case_insensitive(self, sample_metadata):
        rule = _rule("library", "is", ["movies"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Horror Classics", "Marvel Collection", "DC Universe"}


# ── Name rules ────────────────────────────────────────────────────────

class TestNameRules:

    def test_name_contains(self, sample_metadata):
        rule = _rule("name", "contains", ["Marvel"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Marvel Collection"]

    def test_name_contains_multiple_values_or(self, sample_metadata):
        rule = _rule("name", "contains", ["Marvel", "DC"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Marvel Collection", "DC Universe"}

    def test_name_not_contains(self, sample_metadata):
        rule = _rule("name", "not_contains", ["Marvel", "DC"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert "Marvel Collection" not in result
        assert "DC Universe" not in result
        assert "Horror Classics" in result

    def test_name_contains_case_insensitive(self, sample_metadata):
        rule = _rule("name", "contains", ["marvel"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Marvel Collection"]

    def test_name_contains_partial_match(self, sample_metadata):
        rule = _rule("name", "contains", ["Classic"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Horror Classics"]


# ── Item count rules ──────────────────────────────────────────────────

class TestItemCountRules:

    def test_item_count_gte(self, sample_metadata):
        rule = _rule("item_count", "gte", [30])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Marvel Collection", "DC Universe"}

    def test_item_count_lte(self, sample_metadata):
        rule = _rule("item_count", "lte", [15])
        result = resolve_smart_rules([rule], sample_metadata)
        assert set(result) == {"Anime Favorites", "Stand-up Specials"}

    def test_item_count_exact_boundary(self, sample_metadata):
        rule = _rule("item_count", "gte", [25])
        result = resolve_smart_rules([rule], sample_metadata)
        assert "Horror Classics" in result  # exactly 25
        assert "Anime Favorites" not in result  # 15

    def test_item_count_zero(self, sample_metadata):
        rule = _rule("item_count", "gte", [0])
        result = resolve_smart_rules([rule], sample_metadata)
        assert len(result) == 5  # everything matches


# ── AND logic (multiple rules) ────────────────────────────────────────

class TestAndLogic:

    def test_two_rules_anded(self, sample_metadata):
        # label includes superhero AND library is Movies
        rules = [
            _rule("label", "includes", ["superhero"]),
            _rule("library", "is", ["Movies"]),
        ]
        result = resolve_smart_rules(rules, sample_metadata)
        assert set(result) == {"Marvel Collection", "DC Universe"}

    def test_and_narrows_results(self, sample_metadata):
        # label includes superhero AND source is trakt
        rules = [
            _rule("label", "includes", ["superhero"]),
            _rule("source", "is", ["trakt"]),
        ]
        result = resolve_smart_rules(rules, sample_metadata)
        assert result == ["Marvel Collection"]

    def test_and_no_overlap(self, sample_metadata):
        # source is plex AND library is Anime — no collection matches both
        rules = [
            _rule("source", "is", ["plex"]),
            _rule("library", "is", ["Anime"]),
        ]
        result = resolve_smart_rules(rules, sample_metadata)
        assert result == []

    def test_three_rules(self, sample_metadata):
        # library Movies AND label superhero AND item_count >= 35
        rules = [
            _rule("library", "is", ["Movies"]),
            _rule("label", "includes", ["superhero"]),
            _rule("item_count", "gte", [35]),
        ]
        result = resolve_smart_rules(rules, sample_metadata)
        assert result == ["Marvel Collection"]  # 40 items, DC has 30


# ── Edge cases ────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_empty_rules_returns_all_collections(self, sample_metadata):
        result = resolve_smart_rules([], sample_metadata)
        assert result == [
            "Horror Classics",
            "Marvel Collection",
            "Anime Favorites",
            "Stand-up Specials",
            "DC Universe",
        ]

    def test_empty_value_rules_are_ignored(self, sample_metadata):
        rules = [
            _rule("label", "includes", []),
            _rule("name", "contains", [""]),
            _rule("source", "is", []),
        ]
        result = resolve_smart_rules(rules, sample_metadata)
        assert result == [
            "Horror Classics",
            "Marvel Collection",
            "Anime Favorites",
            "Stand-up Specials",
            "DC Universe",
        ]

    def test_only_active_rules_are_applied(self, sample_metadata):
        rules = [
            _rule("label", "includes", []),
            _rule("source", "is", ["trakt"]),
        ]
        result = resolve_smart_rules(rules, sample_metadata)
        assert result == ["Marvel Collection"]

    def test_empty_metadata_returns_empty(self):
        rule = _rule("label", "includes", ["horror"])
        result = resolve_smart_rules([rule], [])
        assert result == []

    def test_single_collection_match(self):
        metadata = [
            CollectionMetadata(name="Test", source="plex", library="Movies", labels=["test"], item_count=5),
        ]
        rule = _rule("label", "includes", ["test"])
        result = resolve_smart_rules([rule], metadata)
        assert result == ["Test"]

    def test_result_preserves_order(self, sample_metadata):
        # Results should come back in the same order as the metadata
        rule = _rule("library", "is", ["Movies"])
        result = resolve_smart_rules([rule], sample_metadata)
        assert result == ["Horror Classics", "Marvel Collection", "DC Universe"]


# ── get_available_filter_options ──────────────────────────────────────

class TestGetAvailableFilterOptions:

    def test_collects_unique_labels(self):
        # Mock server that returns no sections (filter options come from metadata)
        class MockSection:
            def __init__(self, title, collections):
                self.title = title
                self._collections = collections
            def collections(self):
                return self._collections

        class MockCollection:
            def __init__(self, title, labels=None, childCount=0):
                self.title = title
                self.labels = [type("Label", (), {"tag": l})() for l in (labels or [])]
                self.childCount = childCount

        class MockLibrary:
            def sections(self):
                return [
                    MockSection("Movies", [
                        MockCollection("Coll A", labels=["horror", "action"]),
                        MockCollection("Coll B", labels=["action", "comedy"]),
                    ]),
                ]

        class MockServer:
            library = MockLibrary()

        class MockConfig:
            trakt = None
            letterboxd = None
            mdblist = None
            tmdb = None
            anilist = None
            mal = None

        options = get_available_filter_options(MockServer(), MockConfig())
        assert sorted(options["labels"]) == ["action", "comedy", "horror"]
        assert "plex" in options["sources"]
        assert "Movies" in options["libraries"]
