"""
Mock Plex client for demo/testing purposes.
Provides realistic sample data without requiring a real Plex Media Server.
"""

from __future__ import annotations

import logging
from typing import Dict, List
from datetime import datetime

logger = logging.getLogger(__name__)


class MockVisibility:
    """Mock visibility object for collections."""

    def __init__(self, collection_title: str):
        self.collection_title = collection_title
        self.home = False
        self.shared = False
        self.recommended = False

    def updateVisibility(self, home: bool = False, shared: bool = False, recommended: bool = False):
        """Update visibility settings (mock - just logs)."""
        self.home = home
        self.shared = shared
        self.recommended = recommended
        logger.info(
            "[MOCK] Updated visibility for '%s': home=%s, shared=%s, recommended=%s",
            self.collection_title, home, shared, recommended
        )


class MockMediaItem:
    """Mock media item (movie or show)."""

    def __init__(self, title: str, year: int, media_type: str = "movie"):
        self.title = title
        self.year = year
        self.type = media_type
        self.ratingKey = f"mock_{hash(title + str(year))}"

        # Mock GUIDs for matching
        if media_type == "movie":
            self.guids = [
                type('obj', (object,), {'id': f'imdb://tt{abs(hash(title)) % 10000000:07d}'})(),
                type('obj', (object,), {'id': f'tmdb://{abs(hash(title + str(year))) % 100000}'})(),
            ]
        else:
            self.guids = [
                type('obj', (object,), {'id': f'tvdb://{abs(hash(title)) % 100000}'})(),
                type('obj', (object,), {'id': f'tmdb://{abs(hash(title + str(year))) % 100000}'})(),
            ]


class MockCollection:
    """Mock Plex collection."""

    def __init__(self, title: str, library_name: str, items: List[MockMediaItem] = None):
        self.title = title
        self.library_name = library_name
        self.ratingKey = f"coll_{hash(title)}"
        self._items = items or []
        self._visibility = MockVisibility(title)

    def visibility(self) -> MockVisibility:
        """Get visibility settings."""
        return self._visibility

    def items(self) -> List[MockMediaItem]:
        """Get items in this collection."""
        return self._items

    def addItems(self, items: List[MockMediaItem]):
        """Add items to collection (mock)."""
        logger.info("[MOCK] Adding %d items to collection '%s'", len(items), self.title)
        self._items.extend(items)

    def removeItems(self, items: List[MockMediaItem]):
        """Remove items from collection (mock)."""
        logger.info("[MOCK] Removing %d items from collection '%s'", len(items), self.title)
        for item in items:
            if item in self._items:
                self._items.remove(item)


class MockLibrary:
    """Mock Plex library section."""

    def __init__(self, name: str, library_type: str = "movie"):
        self.title = name
        self.type = library_type
        self._collections: Dict[str, MockCollection] = {}
        self._all_items: List[MockMediaItem] = []
        self._initialize_sample_data()

    def _initialize_sample_data(self):
        """Initialize with sample collections and media items."""
        if self.type == "movie":
            self._initialize_movie_library()
        elif self.type == "show":
            self._initialize_tv_library()

    def _initialize_movie_library(self):
        """Create sample movie collections."""
        # Sample movies
        sample_movies = [
            MockMediaItem("The Shawshank Redemption", 1994),
            MockMediaItem("The Godfather", 1972),
            MockMediaItem("The Dark Knight", 2008),
            MockMediaItem("Pulp Fiction", 1994),
            MockMediaItem("Forrest Gump", 1994),
            MockMediaItem("Inception", 2010),
            MockMediaItem("The Matrix", 1999),
            MockMediaItem("Goodfellas", 1990),
            MockMediaItem("The Silence of the Lambs", 1991),
            MockMediaItem("Saving Private Ryan", 1998),
            MockMediaItem("The Green Mile", 1999),
            MockMediaItem("Interstellar", 2014),
            MockMediaItem("Gladiator", 2000),
            MockMediaItem("The Departed", 2006),
            MockMediaItem("The Prestige", 2006),
            MockMediaItem("Whiplash", 2014),
            MockMediaItem("The Lion King", 1994),
            MockMediaItem("Spirited Away", 2001),
            MockMediaItem("Princess Mononoke", 1997),
            MockMediaItem("My Neighbor Totoro", 1988),
            MockMediaItem("Howl's Moving Castle", 2004),
            MockMediaItem("Die Hard", 1988),
            MockMediaItem("Terminator 2: Judgment Day", 1991),
            MockMediaItem("RoboCop", 1987),
            MockMediaItem("Predator", 1987),
            MockMediaItem("The Breakfast Club", 1985),
            MockMediaItem("Ferris Bueller's Day Off", 1986),
            MockMediaItem("Back to the Future", 1985),
            MockMediaItem("Oppenheimer", 2023),
            MockMediaItem("Everything Everywhere All at Once", 2022),
        ]
        self._all_items = sample_movies

        # Create collections with subsets of movies
        collections_data = {
            "Oscar Winners 2024": sample_movies[28:30],
            "80s Action Classics": sample_movies[21:25],
            "Criterion Collection": sample_movies[0:8],
            "Studio Ghibli Films": sample_movies[17:21],
            "Nolan Collection": [sample_movies[2], sample_movies[5], sample_movies[11], sample_movies[14]],
            "90s Crime Dramas": sample_movies[1:4] + sample_movies[7:9],
            "Best Picture Winners": [sample_movies[0], sample_movies[1], sample_movies[4], sample_movies[12]],
            "Sci-Fi Essentials": [sample_movies[5], sample_movies[6], sample_movies[11]],
        }

        for title, items in collections_data.items():
            self._collections[title] = MockCollection(title, self.title, items)

    def _initialize_tv_library(self):
        """Create sample TV show collections."""
        sample_shows = [
            MockMediaItem("Breaking Bad", 2008, "show"),
            MockMediaItem("The Sopranos", 1999, "show"),
            MockMediaItem("The Wire", 2002, "show"),
            MockMediaItem("Game of Thrones", 2011, "show"),
            MockMediaItem("Better Call Saul", 2015, "show"),
            MockMediaItem("Friends", 1994, "show"),
            MockMediaItem("Seinfeld", 1989, "show"),
            MockMediaItem("The Office", 2005, "show"),
            MockMediaItem("Parks and Recreation", 2009, "show"),
            MockMediaItem("Arrested Development", 2003, "show"),
            MockMediaItem("The IT Crowd", 2006, "show"),
            MockMediaItem("Fleabag", 2016, "show"),
            MockMediaItem("Cowboy Bebop", 1998, "show"),
            MockMediaItem("Death Note", 2006, "show"),
            MockMediaItem("Attack on Titan", 2013, "show"),
            MockMediaItem("Fullmetal Alchemist: Brotherhood", 2009, "show"),
        ]
        self._all_items = sample_shows

        collections_data = {
            "HBO Prestige Dramas": sample_shows[0:5],
            "90s Sitcoms": sample_shows[5:8],
            "Modern Comedy Classics": sample_shows[7:10],
            "British Comedy": sample_shows[10:12],
            "Anime Classics": sample_shows[12:16],
        }

        for title, items in collections_data.items():
            self._collections[title] = MockCollection(title, self.title, items)

    def collections(self) -> List[MockCollection]:
        """Get all collections in this library."""
        return list(self._collections.values())

    def search(self, title: str = None, year: int = None, libtype: str = None, **kwargs) -> List[MockMediaItem]:
        """Search for media items in library."""
        results = []
        for item in self._all_items:
            if title and title.lower() not in item.title.lower():
                continue
            if year and item.year != year:
                continue
            if libtype and item.type != libtype:
                continue
            results.append(item)
        return results

    def createCollection(self, title: str, items: List[MockMediaItem] = None) -> MockCollection:
        """Create a new collection (mock)."""
        logger.info("[MOCK] Creating collection '%s' in library '%s'", title, self.title)
        if title not in self._collections:
            self._collections[title] = MockCollection(title, self.title, items or [])
        return self._collections[title]


class MockLibrarySection:
    """Mock library section manager."""

    def __init__(self):
        self._libraries: Dict[str, MockLibrary] = {
            "Movies": MockLibrary("Movies", "movie"),
            "TV Shows": MockLibrary("TV Shows", "show"),
            "Anime": MockLibrary("Anime", "show"),
        }

    def section(self, name: str) -> MockLibrary:
        """Get a library section by name."""
        if name not in self._libraries:
            raise ValueError(f"Library section '{name}' not found")
        return self._libraries[name]


class MockPlexServer:
    """Mock Plex server that mimics plexapi.server.PlexServer interface."""

    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token
        self.library = MockLibrarySection()

        # Server metadata
        self.friendlyName = "HomeScreen Hero Demo Server"
        self.version = "1.40.0.0000-demo"
        self.myPlexUsername = "demo_user"

        logger.info(
            "[MOCK] Connected to mock Plex server at %s (Demo Mode)",
            base_url
        )

    def __repr__(self):
        return f"<MockPlexServer:{self.friendlyName}>"


def get_mock_plex_server(base_url: str, token: str) -> MockPlexServer:
    """Factory function to create a mock Plex server."""
    return MockPlexServer(base_url, token)
