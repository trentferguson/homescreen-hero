from __future__ import annotations

import unicodedata
import logging

logger = logging.getLogger(__name__)

# Unicode superscript/subscript digit mapping
_SUPER_SUB_DIGITS = str.maketrans(
    "⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉",
    "01234567890123456789",
)


def normalize_title(title: str) -> str:
    # Normalize Unicode characters that look like ASCII equivalents
    normalized = unicodedata.normalize("NFKC", title)

    return normalized.translate(_SUPER_SUB_DIGITS)


def build_guid_map(library) -> dict:
    guid_map = {}
    for item in library.all(includeGuids=1):
        # Map primary GUID (covers legacy agent format like com.plexapp.agents.themoviedb://...)
        if item.guid:
            guid_map[item.guid] = item
        # Map external GUIDs (imdb://tt1234567, tmdb://12345, tvdb://12345)
        for guid in getattr(item, "guids", None) or []:
            guid_id = getattr(guid, "id", None)
            if guid_id:
                guid_map[guid_id] = item
    return guid_map


def find_movie(guid_map, library, title, year, imdb_id=None, tmdb_id=None):
    # Match a movie against the Plex library using GUID map first, then title/year fallback

    if tmdb_id is not None:
        item = guid_map.get(f"tmdb://{tmdb_id}")
        if item:
            return item

    if imdb_id:
        item = guid_map.get(f"imdb://{imdb_id}")
        if item:
            return item

    if tmdb_id is not None:
        item = guid_map.get(f"com.plexapp.agents.themoviedb://{tmdb_id}?lang=en")
        if item:
            return item

    if imdb_id:
        item = guid_map.get(f"com.plexapp.agents.imdb://{imdb_id}?lang=en")
        if item:
            return item

    # Fallback Matching: title/year search with normalized title
    normalized = normalize_title(title)
    search_title = normalized if normalized != title else title

    if year:
        results = library.search(title=search_title, year=year)
    else:
        results = library.search(title=search_title)

    if results:
        return results[0]

    if normalized != title:
        if year:
            results = library.search(title=title, year=year)
        else:
            results = library.search(title=title)
        if results:
            return results[0]

    return None


def find_show(guid_map, library, title, year, tvdb_id=None, tmdb_id=None, imdb_id=None):
    # Match a show against the Plex library using GUID map first, then title/year fallback

    if tvdb_id is not None:
        item = guid_map.get(f"tvdb://{tvdb_id}")
        if item:
            return item

    if tmdb_id is not None:
        item = guid_map.get(f"tmdb://{tmdb_id}")
        if item:
            return item

    if imdb_id:
        item = guid_map.get(f"imdb://{imdb_id}")
        if item:
            return item

    # Legacy agent formats
    if tvdb_id is not None:
        item = guid_map.get(f"com.plexapp.agents.thetvdb://{tvdb_id}?lang=en")
        if item:
            return item

    if tmdb_id is not None:
        item = guid_map.get(f"com.plexapp.agents.themoviedb://{tmdb_id}?lang=en")
        if item:
            return item

    if imdb_id:
        item = guid_map.get(f"com.plexapp.agents.imdb://{imdb_id}?lang=en")
        if item:
            return item

    # Fallback: title/year search with normalized title
    normalized = normalize_title(title)
    search_title = normalized if normalized != title else title

    if year:
        results = library.search(title=search_title, year=year)
    else:
        results = library.search(title=search_title)

    if results:
        return results[0]

    if normalized != title:
        if year:
            results = library.search(title=title, year=year)
        else:
            results = library.search(title=title)
        if results:
            return results[0]

    return None
