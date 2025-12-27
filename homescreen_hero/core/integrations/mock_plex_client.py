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

    def __init__(self, collection_title: str, is_active: bool = False):
        self.collection_title = collection_title
        self.home = is_active
        self.shared = False
        self.recommended = False
        # This is the attribute checked by the active collections endpoint
        self.promotedToOwnHome = is_active

    def updateVisibility(self, home: bool = False, shared: bool = False, recommended: bool = False):
        """Update visibility settings (mock - just logs)."""
        self.home = home
        self.shared = shared
        self.recommended = recommended
        self.promotedToOwnHome = home  # Update this too
        logger.info(
            "[MOCK] Updated visibility for '%s': home=%s, shared=%s, recommended=%s",
            self.collection_title, home, shared, recommended
        )


class MockMediaItem:
    """Mock media item (movie or show)."""

    # TMDb poster paths for our sample content
    # Using TMDb's image CDN: https://image.tmdb.org/t/p/w500/{poster_path}
    TMDB_POSTERS = {
        # Movies
        "The Shawshank Redemption": "/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg",
        "The Godfather": "/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
        "The Dark Knight": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        "Pulp Fiction": "/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
        "Forrest Gump": "/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
        "Inception": "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
        "The Matrix": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        "Goodfellas": "/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg",
        "The Silence of the Lambs": "/uS9m8OBk1A8eM9I042bx8XXpqAq.jpg",
        "Saving Private Ryan": "/uqx37cS8cpHg8U35f9U5IBlrCV3.jpg",
        "The Green Mile": "/8VG8fDNiy50H4FedGwdSVUPoaJe.jpg",
        "Interstellar": "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        "Gladiator": "/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg",
        "The Departed": "/nT97ifVT2J1yMQmeq20Qblg61T.jpg",
        "The Prestige": "/tRNlZbgNCNOpLpbPEz5L8G8A0JN.jpg",
        "Whiplash": "/7fn624j5lj3xTme2SgiLCeuedmO.jpg",
        "The Lion King": "/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg",
        "Spirited Away": "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
        "Princess Mononoke": "/jHWmNr7m544fJ8eItsfNk8fs2Ed.jpg",
        "My Neighbor Totoro": "/rtGDOeG9LzoerkDGZF9dnVeLppL.jpg",
        "Howl's Moving Castle": "/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg",
        "Die Hard": "/yFihWxQcmqcaBR31QM6Y8gT6aYV.jpg",
        "Terminator 2: Judgment Day": "/5M0j0B18abtBI5gi2RhfjjurTqb.jpg",
        "RoboCop": "/esmAU0fCO28FbS6bUBKLAzJrohZ.jpg",
        "Predator": "/k3mW4qfJo6SKqe6laRyNGnbB9n5.jpg",
        "The Breakfast Club": "/5AZMNmF40Am36MqN98yOXTUp5tc.jpg",
        "Ferris Bueller's Day Off": "/9LRsbnvOsGrqkZ9BnAACO9sORci.jpg",
        "Back to the Future": "/fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg",
        "Oppenheimer": "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
        "Everything Everywhere All at Once": "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
        # Recently Added / Popular Movies
        "The Batman": "/74xTEgt7R36Fpooo50r9T25onhq.jpg",
        "Barbie": "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
        "Dune": "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg",
        "Dune: Part Two": "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
        "The Dark Knight Rises": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
        "The Lord of the Rings: The Return of the King": "/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
        "The Matrix Reloaded": "/p96dm7sCMn4VYAStA6siNz30G1r.jpg",
        "The Lord of the Rings: The Fellowship of the Ring": "/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
        "The Lord of the Rings: The Two Towers": "/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg",
        "Star Wars": "/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg",
        "Iron Man": "/78lPtwv72eTNqFW9COBYI0dWDJa.jpg",
        "Avengers: Infinity War": "/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
        "Avengers: Endgame": "/bR8ISy1O9XQxqiy0fQFw2BX72RQ.jpg",
        "Schindler's List": "/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg",
        "Fight Club": "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
        # TV Shows
        "Breaking Bad": "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
        "The Sopranos": "/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg",
        "The Wire": "/4lbclFySvugI51fwsyxBTOm4DqK.jpg",
        "Game of Thrones": "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
        "Better Call Saul": "/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg",
        "Friends": "/f496cm9enuEsZkSPzCwnTESEK5s.jpg",
        "Seinfeld": "/aCw8ONfyz3AhngVQa1E2Ss4KSUQ.jpg",
        "The Office": "/7DJKHzAi83BmQrWLrYYOqcoKfhR.jpg",
        "Parks and Recreation": "/dFs6yHxheEGoZSoA0Fdkgy6Jxh0.jpg",
        "Arrested Development": "/qMzwO952hMWQSCfHkp7IL20s4K7.jpg",
        "The IT Crowd": "/qZXkBoOUYzvKI4UCMzDQ5kqWHjh.jpg",
        "Fleabag": "/27vEYsRKa3eAniwmoccOoluEXQ1.jpg",
        "Cowboy Bebop": "/xDiXDfZwC6XYC6fxHI1jl3A3Ill.jpg",
        "Death Note": "/tCZFfYTIwrR7n94J6G14Y4hAFU6.jpg",
        "Attack on Titan": "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
        "Fullmetal Alchemist: Brotherhood": "/5ZFUEOULaVml7pQuXxhpR2SmVUw.jpg",
    }

    def __init__(self, title: str, year: int, media_type: str = "movie"):
        self.title = title
        self.year = year
        self.type = media_type
        # Use a positive integer rating key (hash can be negative)
        self.ratingKey = abs(hash(title + str(year))) % 1000000

        # Add poster/thumb using TMDb CDN
        poster_path = self.TMDB_POSTERS.get(title, "/placeholder.jpg")
        self.thumb = f"https://image.tmdb.org/t/p/w500{poster_path}"

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

    def addCollection(self, collection_name: str):
        """Add this item to a collection (mock - just logs)."""
        logger.info("[MOCK] Adding '%s' to collection '%s'", self.title, collection_name)

    def removeCollection(self, collection_name: str):
        """Remove this item from a collection (mock - just logs)."""
        logger.info("[MOCK] Removing '%s' from collection '%s'", self.title, collection_name)


class MockCollection:
    """Mock Plex collection."""

    def __init__(self, title: str, library_name: str, items: List[MockMediaItem] = None, is_active: bool = False):
        self.title = title
        self.library_name = library_name
        self.ratingKey = f"coll_{hash(title)}"
        self._items = items or []
        self._visibility = MockVisibility(title, is_active=is_active)
        # Use the first item's poster as the collection poster, or a placeholder
        if self._items:
            self.thumb = self._items[0].thumb
        else:
            self.thumb = "https://image.tmdb.org/t/p/w500/placeholder.jpg"

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
            # New popular/recent movies
            MockMediaItem("The Batman", 2022),
            MockMediaItem("Barbie", 2023),
            MockMediaItem("Dune", 2021),
            MockMediaItem("Dune: Part Two", 2024),
            MockMediaItem("The Dark Knight Rises", 2012),
            MockMediaItem("The Lord of the Rings: The Return of the King", 2003),
            MockMediaItem("The Matrix Reloaded", 2003),
            MockMediaItem("The Lord of the Rings: The Fellowship of the Ring", 2001),
            MockMediaItem("The Lord of the Rings: The Two Towers", 2002),
            MockMediaItem("Star Wars", 1977),
            MockMediaItem("Iron Man", 2008),
            MockMediaItem("Avengers: Infinity War", 2018),
            MockMediaItem("Avengers: Endgame", 2019),
            MockMediaItem("Schindler's List", 1993),
            MockMediaItem("Fight Club", 1999),
        ]
        self._all_items = sample_movies

        # Create collections with subsets of movies
        # Some collections are marked as active (visible on home screen) for demo purposes
        collections_data = {
            "Oscar Winners 2024": (sample_movies[28:30], True),  # Active
            "80s Action Classics": (sample_movies[21:25], True),  # Active
            "Criterion Collection": (sample_movies[0:8], False),
            "Studio Ghibli Films": (sample_movies[17:21], True),  # Active
            "Recently Requested by You": ([sample_movies[30], sample_movies[33], sample_movies[38], sample_movies[41], sample_movies[42]], True),  # Active - Batman, Dune 2, LOTR:FOTR, Iron Man, Avengers: Infinity War
            "Trending Movies": ([sample_movies[31], sample_movies[32], sample_movies[28], sample_movies[29]], True),  # Active - Barbie, Dune, Oppenheimer, EEAAO
            "Nolan Collection": ([sample_movies[2], sample_movies[5], sample_movies[11], sample_movies[14]], False),
            "90s Crime Dramas": (sample_movies[1:4] + sample_movies[7:9], False),
            "Best Picture Winners": ([sample_movies[0], sample_movies[1], sample_movies[4], sample_movies[12]], False),
            "Sci-Fi Essentials": ([sample_movies[5], sample_movies[6], sample_movies[11]], False),
            "The Lord of the Rings Trilogy": ([sample_movies[38], sample_movies[39], sample_movies[35]], False),  # FOTR, Two Towers, ROTK
            "MCU Favorites": ([sample_movies[41], sample_movies[42], sample_movies[43]], False),  # Iron Man, Infinity War, Endgame
        }

        for title, (items, is_active) in collections_data.items():
            self._collections[title] = MockCollection(title, self.title, items, is_active=is_active)

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
            "HBO Prestige Dramas": (sample_shows[0:5], True),  # Active
            "90s Sitcoms": (sample_shows[5:8], True),  # Active
            "Hot on TV": ([sample_shows[0], sample_shows[3], sample_shows[4], sample_shows[11]], True),  # Active - Breaking Bad, GoT, Better Call Saul, Fleabag
            "Modern Comedy Classics": (sample_shows[7:10], False),
            "British Comedy": (sample_shows[10:12], False),
            "Anime Classics": (sample_shows[12:16], False),
        }

        for title, (items, is_active) in collections_data.items():
            self._collections[title] = MockCollection(title, self.title, items, is_active=is_active)

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

    def all(self, limit: int = None) -> List[MockMediaItem]:
        """Get all items in this library."""
        if limit:
            return self._all_items[:limit]
        return self._all_items

    def fetchItem(self, rating_key: int) -> MockMediaItem:
        """Fetch a single item by rating key."""
        for item in self._all_items:
            if item.ratingKey == rating_key:
                return item

        # Return None instead of raising exception (matches PlexAPI behavior)
        return None


class MockLibrarySection:
    """Mock library section manager."""

    def __init__(self):
        self._libraries: Dict[str, MockLibrary] = {
            "Movies": MockLibrary("Movies", "movie"),
            "TV Shows": MockLibrary("TV Shows", "show"),
        }

    def section(self, name: str) -> MockLibrary:
        """Get a library section by name."""
        if name not in self._libraries:
            raise ValueError(f"Library section '{name}' not found")
        return self._libraries[name]

    def sections(self) -> List[MockLibrary]:
        """Get all library sections."""
        return list(self._libraries.values())


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

    def url(self, path: str, includeToken: bool = False) -> str:
        """Generate a URL for a resource path (mock)."""
        # If the path is already a full URL (like TMDb CDN), return it as-is
        if path.startswith("http://") or path.startswith("https://"):
            return path

        # Otherwise, construct a Plex-style URL
        url = f"{self.base_url}{path}"
        if includeToken:
            url += f"?X-Plex-Token={self.token}"
        return url

    def __repr__(self):
        return f"<MockPlexServer:{self.friendlyName}>"


def get_mock_plex_server(base_url: str, token: str) -> MockPlexServer:
    """Factory function to create a mock Plex server."""
    return MockPlexServer(base_url, token)
