from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Set

import logging

from homescreen_hero.core.config.schema import AppConfig
from homescreen_hero.core.db.models import SeerrAutoRequest, TraktMissingItem, MDBListMissingItem, LetterboxdMissingItem
from homescreen_hero.core.integrations.seerr_client import get_seerr_client

logger = logging.getLogger(__name__)


@dataclass
class AutoRequestResult:
    requested: int = 0
    skipped: int = 0       # already requested previously
    already_exists: int = 0  # Seerr says already requested/available (409)
    failed: int = 0
    no_tmdb_id: int = 0


# Map integration type to its missing item model class
_MISSING_ITEM_MODELS = {
    "trakt": TraktMissingItem,
    "mdblist": MDBListMissingItem,
    "letterboxd": LetterboxdMissingItem,
}


def process_auto_requests_for_source(
    config: AppConfig,
    integration_type: str,
    source_name: str,
    library_type: str,
) -> AutoRequestResult:
    # Send Seerr requests for missing items from a synced source.
    # library_type is the Plex library type ("movie" or "show").
    result = AutoRequestResult()

    seerr_client = get_seerr_client(config)
    if seerr_client is None:
        logger.debug("Seerr not configured; skipping auto-request for '%s'", source_name)
        return result

    model_cls = _MISSING_ITEM_MODELS.get(integration_type)
    if model_cls is None:
        logger.warning("No missing item model for integration type '%s'", integration_type)
        return result

    media_type = "movie" if library_type == "movie" else "tv"

    from homescreen_hero.core.db import get_session

    with get_session() as session:
        # Get all missing items for this source that have a TMDb ID
        missing_items = (
            session.query(model_cls)
            .filter(
                model_cls.source_name == source_name,
                model_cls.tmdb_id.isnot(None),
            )
            .all()
        )

        if not missing_items:
            logger.debug("No missing items with TMDb IDs for source '%s'", source_name)
            return result

        for item in missing_items:
            tmdb_id = item.tmdb_id

            # Check if we already requested this
            existing = (
                session.query(SeerrAutoRequest)
                .filter(
                    SeerrAutoRequest.tmdb_id == tmdb_id,
                    SeerrAutoRequest.media_type == media_type,
                )
                .first()
            )

            if existing:
                result.skipped += 1
                continue

            # Send request to Seerr
            success, error_msg, _response = seerr_client.create_request(
                media_type=media_type,
                media_id=tmdb_id,
            )

            if success:
                status = "requested"
                result.requested += 1
                logger.info(
                    "Requested %s '%s' (%s) via Seerr [tmdb:%d]",
                    media_type, item.title, item.year, tmdb_id,
                )
            elif error_msg and "already requested" in error_msg.lower():
                status = "already_exists"
                result.already_exists += 1
                logger.debug(
                    "Already requested/available in Seerr: '%s' (%s) [tmdb:%d]",
                    item.title, item.year, tmdb_id,
                )
            else:
                status = "failed"
                result.failed += 1
                logger.warning(
                    "Failed to request '%s' (%s) via Seerr: %s",
                    item.title, item.year, error_msg,
                )

            # Record the request attempt
            record = SeerrAutoRequest(
                tmdb_id=tmdb_id,
                media_type=media_type,
                title=item.title,
                year=item.year,
                integration_type=integration_type,
                source_name=source_name,
                status=status,
                error_message=error_msg if status == "failed" else None,
                requested_at=datetime.utcnow(),
            )
            session.add(record)

        session.commit()

    return result


def mark_auto_requests_downloaded(tmdb_ids: Set[int], media_type: str) -> int:
    # Mark previously-requested items as downloaded when they appear in Plex.
    # Returns the number of rows updated.
    if not tmdb_ids:
        return 0

    from homescreen_hero.core.db import get_session

    with get_session() as session:
        rows = (
            session.query(SeerrAutoRequest)
            .filter(
                SeerrAutoRequest.tmdb_id.in_(tmdb_ids),
                SeerrAutoRequest.media_type == media_type,
                SeerrAutoRequest.status == "requested",
            )
            .all()
        )

        for row in rows:
            row.status = "downloaded"
            row.downloaded_at = datetime.utcnow()
            logger.info(
                "Marked auto-request as downloaded: '%s' (%s) [tmdb:%d]",
                row.title, row.year, row.tmdb_id,
            )

        session.commit()
        return len(rows)


def process_all_auto_requests(config: AppConfig) -> dict[str, AutoRequestResult]:
    # Process auto-requests for all sources across all integrations that have auto_request enabled.
    # Returns a dict of source_name -> AutoRequestResult.
    from homescreen_hero.core.integrations.plex_client import get_plex_server

    results: dict[str, AutoRequestResult] = {}

    seerr_client = get_seerr_client(config)
    if seerr_client is None:
        logger.info("Seerr not configured; skipping all auto-requests")
        return results

    server = get_plex_server(config)

    # Trakt sources
    if config.trakt and config.trakt.enabled and config.trakt.sources:
        for source in config.trakt.sources:
            if not source.auto_request:
                continue
            try:
                library = server.library.section(source.plex_library)
                result = process_auto_requests_for_source(
                    config=config,
                    integration_type="trakt",
                    source_name=source.name,
                    library_type=library.type,
                )
                results[f"trakt:{source.name}"] = result
            except Exception as e:
                logger.error("Auto-request failed for Trakt source '%s': %s", source.name, e)
                results[f"trakt:{source.name}"] = AutoRequestResult(failed=-1)

    # MDBList sources
    if config.mdblist and config.mdblist.enabled and config.mdblist.sources:
        for source in config.mdblist.sources:
            if not source.auto_request:
                continue
            try:
                library = server.library.section(source.plex_library)
                result = process_auto_requests_for_source(
                    config=config,
                    integration_type="mdblist",
                    source_name=source.name,
                    library_type=library.type,
                )
                results[f"mdblist:{source.name}"] = result
            except Exception as e:
                logger.error("Auto-request failed for MDBList source '%s': %s", source.name, e)
                results[f"mdblist:{source.name}"] = AutoRequestResult(failed=-1)

    # Letterboxd sources
    if config.letterboxd and config.letterboxd.sources:
        for source in config.letterboxd.sources:
            if not source.auto_request:
                continue
            try:
                library = server.library.section(source.plex_library)
                # Resolve TMDb IDs via Seerr search before requesting
                from homescreen_hero.core.integrations.seerr_resolve import resolve_letterboxd_tmdb_ids
                resolve_letterboxd_tmdb_ids(config, source.name)

                result = process_auto_requests_for_source(
                    config=config,
                    integration_type="letterboxd",
                    source_name=source.name,
                    library_type=library.type,
                )
                results[f"letterboxd:{source.name}"] = result
            except Exception as e:
                logger.error("Auto-request failed for Letterboxd source '%s': %s", source.name, e)
                results[f"letterboxd:{source.name}"] = AutoRequestResult(failed=-1)

    return results
