from __future__ import annotations

from typing import Optional

import logging

from homescreen_hero.core.config.schema import AppConfig
from homescreen_hero.core.db.models import LetterboxdMissingItem
from homescreen_hero.core.integrations.seerr_client import get_seerr_client, SeerrClient

logger = logging.getLogger(__name__)


def _match_tmdb_id_from_seerr(
    seerr_client: SeerrClient,
    title: str,
    year: Optional[int],
) -> Optional[int]:
    # Search Seerr for a movie by title and return the TMDb ID of the best match.
    response = seerr_client.search(title)
    results = response.get("results", [])

    # Letterboxd is movie-only
    movie_results = [r for r in results if r.get("mediaType") == "movie"]

    if not movie_results:
        return None

    # If we have a year, prefer an exact year match
    if year:
        for result in movie_results:
            release_date = result.get("releaseDate", "")
            if release_date and release_date.startswith(str(year)):
                return result.get("id")

    # Fall back to first movie result (Seerr ranks by relevance)
    return movie_results[0].get("id")


def resolve_letterboxd_tmdb_ids(config: AppConfig, source_name: str) -> int:
    # Resolve TMDb IDs for Letterboxd missing items that don't have one yet.
    # Uses Seerr search to find the TMDb ID from title + year.
    # Returns the number of items successfully resolved.
    seerr_client = get_seerr_client(config)
    if seerr_client is None:
        logger.debug("Seerr not configured; skipping TMDb ID resolution for '%s'", source_name)
        return 0

    from homescreen_hero.core.db import get_session

    resolved = 0

    with get_session() as session:
        items = (
            session.query(LetterboxdMissingItem)
            .filter(
                LetterboxdMissingItem.source_name == source_name,
                LetterboxdMissingItem.tmdb_id.is_(None),
            )
            .all()
        )

        if not items:
            logger.debug("No unresolved Letterboxd items for source '%s'", source_name)
            return 0

        logger.info("Resolving TMDb IDs for %d Letterboxd items via Seerr search", len(items))

        for item in items:
            tmdb_id = _match_tmdb_id_from_seerr(seerr_client, item.title, item.year)

            if tmdb_id is not None:
                item.tmdb_id = tmdb_id
                resolved += 1
                logger.debug(
                    "Resolved '%s' (%s) -> tmdb:%d",
                    item.title, item.year, tmdb_id,
                )
            else:
                logger.debug(
                    "Could not resolve TMDb ID for '%s' (%s)",
                    item.title, item.year,
                )

        session.commit()

    logger.info("Resolved %d/%d TMDb IDs for Letterboxd source '%s'", resolved, len(items), source_name)
    return resolved
