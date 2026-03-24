import logging

from homescreen_hero.core.config.schema import (
    AppConfig,
    PlexLibraryConfig,
    PlexSettings,
    RotationSettings,
)
from homescreen_hero.core.integrations import plex_client


class FakeHub:
    def __init__(self, section, title: str, fail_first_move: bool = False):
        self.section = section
        self.title = title
        self.identifier = title.replace(" ", "_")
        self.fail_first_move = fail_first_move
        self.move_calls = 0

    def move(self, after=None):
        self.move_calls += 1
        if self.fail_first_move and self.move_calls == 1:
            raise Exception("Simulated Plex API failure")

        hubs = self.section._hubs
        hubs.remove(self)
        if after is None:
            hubs.insert(0, self)
            return

        after_index = hubs.index(after)
        hubs.insert(after_index + 1, self)


class FakeSection:
    def __init__(self, name: str, titles: list[str], fail_first_move_for: set[str] | None = None):
        fail_first_move_for = fail_first_move_for or set()
        self.title = name
        self._hubs = [
            FakeHub(self, title, fail_first_move=title in fail_first_move_for)
            for title in titles
        ]

    def managedHubs(self):
        return list(self._hubs)


class FakeLibraryManager:
    def __init__(self, sections: dict[str, FakeSection]):
        self._sections = sections

    def section(self, name: str) -> FakeSection:
        return self._sections[name]


class FakeServer:
    def __init__(self, sections: dict[str, FakeSection]):
        self.library = FakeLibraryManager(sections)


def _make_config(*library_names: str) -> AppConfig:
    return AppConfig(
        plex=PlexSettings(
            base_url="http://localhost:32400",
            token="test-token",
            libraries=[PlexLibraryConfig(name=name, enabled=True) for name in library_names],
        ),
        rotation=RotationSettings(
            enabled=True,
            max_collections=10,
        ),
        groups=[],
    )


def test_reorder_homescreen_collections_matches_requested_order(monkeypatch):
    monkeypatch.setattr(plex_client.time, "sleep", lambda _seconds: None)

    section = FakeSection("Movies", ["Gamma", "Delta", "Beta", "Alpha"])
    server = FakeServer({"Movies": section})
    config = _make_config("Movies")

    applied = plex_client.reorder_homescreen_collections(
        server,
        config,
        ["Alpha", "Beta", "Gamma"],
    )

    assert applied == ["Alpha", "Beta", "Gamma"]
    assert [hub.title for hub in section.managedHubs()[:3]] == ["Alpha", "Beta", "Gamma"]


def test_reorder_homescreen_collections_retries_when_first_pass_misorders(monkeypatch, caplog):
    monkeypatch.setattr(plex_client.time, "sleep", lambda _seconds: None)

    section = FakeSection(
        "Movies",
        ["Delta", "Gamma", "Beta", "Alpha"],
        fail_first_move_for={"Beta"},
    )
    server = FakeServer({"Movies": section})
    config = _make_config("Movies")

    with caplog.at_level(logging.WARNING):
        applied = plex_client.reorder_homescreen_collections(
            server,
            config,
            ["Alpha", "Beta", "Gamma"],
        )

    assert applied == ["Alpha", "Beta", "Gamma"]
    assert [hub.title for hub in section.managedHubs()[:3]] == ["Alpha", "Beta", "Gamma"]
    assert "Managed hub order mismatch" in caplog.text


def test_reorder_homescreen_collections_handles_each_library_separately(monkeypatch):
    monkeypatch.setattr(plex_client.time, "sleep", lambda _seconds: None)

    movies = FakeSection("Movies", ["Movie B", "Movie A"])
    shows = FakeSection("Shows", ["Show B", "Show A"])
    server = FakeServer({"Movies": movies, "Shows": shows})
    config = _make_config("Movies", "Shows")

    applied = plex_client.reorder_homescreen_collections(
        server,
        config,
        ["Movie A", "Show A", "Movie B", "Show B"],
    )

    assert applied == ["Movie A", "Movie B", "Show A", "Show B"]
    assert [hub.title for hub in movies.managedHubs()[:2]] == ["Movie A", "Movie B"]
    assert [hub.title for hub in shows.managedHubs()[:2]] == ["Show A", "Show B"]
