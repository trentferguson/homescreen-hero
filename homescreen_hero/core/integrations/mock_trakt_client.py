"""
Mock Trakt client for demo/testing purposes.
Provides realistic sample data without requiring a real Trakt API key.
"""

from __future__ import annotations

import logging
from typing import Any, List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class MockTraktClient:
    """Mock Trakt API client that returns sample data."""

    def __init__(self, client_id: str = "mock_client_id"):
        self.client_id = client_id
        self.base_url = "https://api.trakt.tv"
        logger.info("[MOCK] Initialized mock Trakt client (Demo Mode)")

    def ping(self) -> Tuple[bool, Optional[str]]:
        """Mock ping - always successful."""
        logger.info("[MOCK] Trakt API ping successful (mock)")
        return True, None

    def get_popular_movies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return mock popular movies."""
        movies = [
            self._create_movie_item("The Shawshank Redemption", 1994, "tt0111161", "278"),
            self._create_movie_item("The Godfather", 1972, "tt0068646", "238"),
            self._create_movie_item("The Dark Knight", 2008, "tt0468569", "155"),
            self._create_movie_item("Pulp Fiction", 1994, "tt0110912", "680"),
            self._create_movie_item("Forrest Gump", 1994, "tt0109830", "13"),
            self._create_movie_item("Inception", 2010, "tt1375666", "27205"),
            self._create_movie_item("The Matrix", 1999, "tt0133093", "603"),
            self._create_movie_item("Goodfellas", 1990, "tt0099685", "769"),
            self._create_movie_item("Interstellar", 2014, "tt0816692", "157336"),
            self._create_movie_item("The Prestige", 2006, "tt0482571", "1124"),
        ]
        return movies[:limit]

    def get_trending_movies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return mock trending movies."""
        movies = [
            self._create_movie_item("Oppenheimer", 2023, "tt15398776", "872585"),
            self._create_movie_item("Everything Everywhere All at Once", 2022, "tt6710474", "545611"),
            self._create_movie_item("The Batman", 2022, "tt1877830", "414906"),
            self._create_movie_item("Dune", 2021, "tt1160419", "438631"),
            self._create_movie_item("Spider-Man: No Way Home", 2021, "tt10872600", "634649"),
            self._create_movie_item("Top Gun: Maverick", 2022, "tt1745960", "361743"),
            self._create_movie_item("Avatar: The Way of Water", 2022, "tt1630029", "76600"),
            self._create_movie_item("The Whale", 2022, "tt13833688", "785084"),
        ]
        return [{"movie": m} for m in movies[:limit]]

    def get_anticipated_movies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return mock anticipated movies."""
        movies = [
            self._create_movie_item("Dune: Part Three", 2026, "tt15239678", "840326"),
            self._create_movie_item("Avatar 3", 2025, "tt1757678", "83533"),
            self._create_movie_item("The Batman Part II", 2025, "tt18983768", "966764"),
        ]
        return [{"movie": m} for m in movies[:limit]]

    def get_popular_shows(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Return mock popular shows."""
        shows = [
            self._create_show_item("Breaking Bad", 2008, "tt0903747", "1396", "81189"),
            self._create_show_item("Game of Thrones", 2011, "tt0944947", "1399", "121361"),
            self._create_show_item("The Sopranos", 1999, "tt0141842", "1398", "79744"),
            self._create_show_item("The Wire", 2002, "tt0306414", "1438", "79126"),
            self._create_show_item("Better Call Saul", 2015, "tt3032476", "60059", "273181"),
        ]
        return shows[:limit]

    def get_list_items_from_url(self, url: str) -> List[Dict[str, Any]]:
        """Return mock list items based on URL pattern."""
        logger.info("[MOCK] Fetching Trakt list from URL: %s", url)

        # Parse URL to determine which mock list to return
        if "oscar-winners" in url.lower() or "academy-awards" in url.lower():
            return self._get_oscar_winners_list()
        elif "action" in url.lower() or "80s" in url.lower():
            return self._get_action_classics_list()
        elif "ghibli" in url.lower() or "anime" in url.lower():
            return self._get_ghibli_list()
        elif "criterion" in url.lower():
            return self._get_criterion_list()
        else:
            # Default list
            return self._get_default_list()

    def _get_oscar_winners_list(self) -> List[Dict[str, Any]]:
        """Mock Oscar winners list."""
        return [
            {
                "type": "movie",
                "movie": self._create_movie_item("Oppenheimer", 2023, "tt15398776", "872585"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Everything Everywhere All at Once", 2022, "tt6710474", "545611"),
            },
        ]

    def _get_action_classics_list(self) -> List[Dict[str, Any]]:
        """Mock 80s action classics list."""
        return [
            {
                "type": "movie",
                "movie": self._create_movie_item("Die Hard", 1988, "tt0095016", "562"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Terminator 2: Judgment Day", 1991, "tt0103064", "280"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("RoboCop", 1987, "tt0093870", "5548"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Predator", 1987, "tt0093773", "106"),
            },
        ]

    def _get_ghibli_list(self) -> List[Dict[str, Any]]:
        """Mock Studio Ghibli list."""
        return [
            {
                "type": "movie",
                "movie": self._create_movie_item("Spirited Away", 2001, "tt0245429", "129"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Princess Mononoke", 1997, "tt0119698", "128"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("My Neighbor Totoro", 1988, "tt0096283", "8392"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Howl's Moving Castle", 2004, "tt0347149", "4935"),
            },
        ]

    def _get_criterion_list(self) -> List[Dict[str, Any]]:
        """Mock Criterion Collection list."""
        return [
            {
                "type": "movie",
                "movie": self._create_movie_item("The Shawshank Redemption", 1994, "tt0111161", "278"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("The Godfather", 1972, "tt0068646", "238"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Pulp Fiction", 1994, "tt0110912", "680"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Goodfellas", 1990, "tt0099685", "769"),
            },
        ]

    def _get_default_list(self) -> List[Dict[str, Any]]:
        """Default mock list."""
        return [
            {
                "type": "movie",
                "movie": self._create_movie_item("The Dark Knight", 2008, "tt0468569", "155"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("Inception", 2010, "tt1375666", "27205"),
            },
            {
                "type": "movie",
                "movie": self._create_movie_item("The Matrix", 1999, "tt0133093", "603"),
            },
        ]

    def _create_movie_item(
        self,
        title: str,
        year: int,
        imdb_id: str,
        tmdb_id: str,
    ) -> Dict[str, Any]:
        """Create a mock movie item in Trakt API format."""
        return {
            "title": title,
            "year": year,
            "ids": {
                "trakt": abs(hash(title)) % 1000000,
                "slug": title.lower().replace(" ", "-").replace(":", ""),
                "imdb": imdb_id,
                "tmdb": int(tmdb_id) if tmdb_id else None,
            }
        }

    def _create_show_item(
        self,
        title: str,
        year: int,
        imdb_id: str,
        tmdb_id: str,
        tvdb_id: str,
    ) -> Dict[str, Any]:
        """Create a mock TV show item in Trakt API format."""
        return {
            "title": title,
            "year": year,
            "ids": {
                "trakt": abs(hash(title)) % 1000000,
                "slug": title.lower().replace(" ", "-").replace(":", ""),
                "imdb": imdb_id,
                "tmdb": int(tmdb_id) if tmdb_id else None,
                "tvdb": int(tvdb_id) if tvdb_id else None,
            }
        }


def get_mock_trakt_client(client_id: str = "mock_client_id") -> MockTraktClient:
    """Factory function to create a mock Trakt client."""
    return MockTraktClient(client_id)
