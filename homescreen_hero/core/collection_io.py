from __future__ import annotations

import base64
import gzip
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from homescreen_hero.core.db.base import get_session
from homescreen_hero.core.db.models import ImportMissingItem
from homescreen_hero.core.integrations.plex_match import (
    build_guid_map,
    find_movie,
    find_show,
)

logger = logging.getLogger(__name__)

SHARE_CODE_PREFIX = "HSH:"
EXPORT_VERSION = 1


# ------------------------------------------------------------------
# GUID helpers
# ------------------------------------------------------------------

def _build_rating_key_guid_map(library) -> dict[int, dict[str, Any]]:
    # Build a ratingKey -> {imdb_id, tmdb_id, tvdb_id} lookup from the library
    guid_lookup: dict[int, dict[str, Any]] = {}
    for item in library.all(includeGuids=1):
        ids: dict[str, Any] = {"imdb_id": None, "tmdb_id": None, "tvdb_id": None}
        for guid in getattr(item, "guids", None) or []:
            guid_id = getattr(guid, "id", None)
            if not guid_id:
                continue
            if guid_id.startswith("imdb://"):
                ids["imdb_id"] = guid_id.replace("imdb://", "")
            elif guid_id.startswith("tmdb://"):
                try:
                    ids["tmdb_id"] = int(guid_id.replace("tmdb://", ""))
                except ValueError:
                    pass
            elif guid_id.startswith("tvdb://"):
                try:
                    ids["tvdb_id"] = int(guid_id.replace("tvdb://", ""))
                except ValueError:
                    pass
        guid_lookup[item.ratingKey] = ids
    return guid_lookup


def _extract_ids(item, guid_lookup: dict[int, dict[str, Any]]) -> dict[str, Any]:
    # Get external IDs for an item using the pre-built lookup
    return guid_lookup.get(item.ratingKey, {"imdb_id": None, "tmdb_id": None, "tvdb_id": None})


# ------------------------------------------------------------------
# Export
# ------------------------------------------------------------------

def export_collections(
    server,
    library_name: str,
    collection_names: list[str],
    include_metadata: bool = False,
) -> dict[str, Any]:
    # Export one or more collections from a Plex library to our portable JSON format

    section = server.library.section(library_name)
    guid_lookup = _build_rating_key_guid_map(section)

    # Build a title -> collection object lookup
    all_collections = {col.title: col for col in section.collections()}

    exported: list[dict[str, Any]] = []
    errors: list[str] = []

    for name in collection_names:
        collection = all_collections.get(name)
        if not collection:
            errors.append(f"Collection '{name}' not found in library '{library_name}'")
            continue

        items_data = _export_collection_items(collection, guid_lookup)

        is_smart = bool(getattr(collection, "smart", False))

        col_data: dict[str, Any] = {
            "name": collection.title,
            "library": library_name,
            "smart": is_smart,
            "items": items_data,
        }

        if include_metadata:
            col_data["summary"] = getattr(collection, "summary", None) or ""
            col_data["labels"] = [
                label.tag for label in (getattr(collection, "labels", None) or [])
            ]
            # Map sort integer to readable string
            sort_val = getattr(collection, "collectionSort", None)
            sort_map = {0: "release", 1: "alpha", 2: "custom"}
            col_data["sort_order"] = sort_map.get(sort_val, "default")

        exported.append(col_data)

    return {
        "version": EXPORT_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "collections": exported,
        "errors": errors,
    }


def _export_collection_items(
    collection, guid_lookup: dict[int, dict[str, Any]]
) -> list[dict[str, Any]]:
    items_data: list[dict[str, Any]] = []
    for position, item in enumerate(collection.items(), start=1):
        entry: dict[str, Any] = {
            "title": item.title,
            "year": getattr(item, "year", None),
            "type": item.type,  # movie, show, season, episode
            "position": position,
            "parent_title": None,
            "season_number": None,
            "episode_number": None,
        }

        if item.type == "episode":
            # Use the show's ratingKey for GUID lookup (library.all() only indexes shows)
            show_rk = getattr(item, "grandparentRatingKey", None)
            ids = guid_lookup.get(show_rk, {"imdb_id": None, "tmdb_id": None, "tvdb_id": None}) if show_rk else {"imdb_id": None, "tmdb_id": None, "tvdb_id": None}
            entry["parent_title"] = getattr(item, "grandparentTitle", None)
            entry["season_number"] = getattr(item, "parentIndex", None)
            entry["episode_number"] = getattr(item, "index", None)
        elif item.type == "season":
            # Use the show's ratingKey for GUID lookup
            show_rk = getattr(item, "parentRatingKey", None)
            ids = guid_lookup.get(show_rk, {"imdb_id": None, "tmdb_id": None, "tvdb_id": None}) if show_rk else {"imdb_id": None, "tmdb_id": None, "tvdb_id": None}
            entry["parent_title"] = getattr(item, "parentTitle", None)
            entry["season_number"] = getattr(item, "index", None)
        else:
            # Movies and shows: use the item's own ratingKey
            ids = _extract_ids(item, guid_lookup)

        entry["tmdb_id"] = ids["tmdb_id"]
        entry["imdb_id"] = ids["imdb_id"]
        entry["tvdb_id"] = ids["tvdb_id"]

        items_data.append(entry)

    return items_data


# ------------------------------------------------------------------
# Share code encoding / decoding
# ------------------------------------------------------------------

def encode_share_code(export_data: dict[str, Any]) -> str:
    # Compress and base64 encode export data into a shareable string
    json_bytes = json.dumps(export_data, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(json_bytes)
    encoded = base64.urlsafe_b64encode(compressed).decode("ascii")
    return SHARE_CODE_PREFIX + encoded


def decode_share_code(share_code: str) -> dict[str, Any]:
    # Decode an HSH: share code back into export JSON
    if not share_code.startswith(SHARE_CODE_PREFIX):
        raise ValueError("Invalid share code: must start with 'HSH:'")

    encoded = share_code[len(SHARE_CODE_PREFIX):]
    compressed = base64.urlsafe_b64decode(encoded)
    json_bytes = gzip.decompress(compressed)
    return json.loads(json_bytes.decode("utf-8"))


# ------------------------------------------------------------------
# Import
# ------------------------------------------------------------------

def parse_import_data(
    file_content: Optional[str] = None,
    share_code: Optional[str] = None,
) -> dict[str, Any]:
    # Parse import data from either a JSON file or a share code
    if share_code:
        return decode_share_code(share_code)
    if file_content:
        return json.loads(file_content)
    raise ValueError("Either file_content or share_code must be provided")


def preview_import(
    server,
    import_data: dict[str, Any],
    target_library: str,
) -> dict[str, Any]:
    # Preview what an import would do without making changes
    section = server.library.section(target_library)
    guid_map = build_guid_map(section)

    existing_collections = {col.title for col in section.collections()}

    results: list[dict[str, Any]] = []
    for col_data in import_data.get("collections", []):
        col_name = col_data["name"]

        # Check for name conflict
        final_name = _resolve_collection_name(col_name, existing_collections)

        matched = 0
        missing = 0
        missing_items: list[dict[str, Any]] = []

        for item_data in col_data.get("items", []):
            plex_item = _match_item(item_data, guid_map, section)
            if plex_item:
                matched += 1
            else:
                missing += 1
                missing_items.append({
                    "title": item_data["title"],
                    "year": item_data.get("year"),
                    "type": item_data.get("type", "movie"),
                })

        results.append({
            "original_name": col_name,
            "final_name": final_name,
            "name_changed": final_name != col_name,
            "total_items": len(col_data.get("items", [])),
            "matched": matched,
            "missing": missing,
            "missing_items": missing_items,
        })

    return {"collections": results}


def apply_import(
    server,
    import_data: dict[str, Any],
    target_library: str,
    import_name: Optional[str] = None,
) -> dict[str, Any]:
    # Import collections into Plex, creating them and adding matched items
    section = server.library.section(target_library)
    guid_map = build_guid_map(section)

    existing_collections = {col.title for col in section.collections()}

    if not import_name:
        import_name = f"import_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    results: list[dict[str, Any]] = []
    all_missing: list[dict[str, Any]] = []

    for col_data in import_data.get("collections", []):
        col_name = col_data["name"]
        final_name = _resolve_collection_name(col_name, existing_collections)
        # Track so subsequent collections don't conflict
        existing_collections.add(final_name)

        matched = 0
        missing = 0
        col_missing: list[dict[str, Any]] = []

        items = col_data.get("items", [])
        # Sort by position to preserve custom order
        items_sorted = sorted(items, key=lambda x: x.get("position", 0))

        for item_data in items_sorted:
            plex_item = _match_item(item_data, guid_map, section)
            if plex_item:
                plex_item.addCollection(final_name)
                matched += 1
            else:
                missing += 1
                missing_entry = {
                    "title": item_data["title"],
                    "year": item_data.get("year"),
                    "type": item_data.get("type", "movie"),
                    "imdb_id": item_data.get("imdb_id"),
                    "tmdb_id": item_data.get("tmdb_id"),
                    "tvdb_id": item_data.get("tvdb_id"),
                    "parent_title": item_data.get("parent_title"),
                    "season_number": item_data.get("season_number"),
                    "episode_number": item_data.get("episode_number"),
                    "plex_library": target_library,
                    "plex_collection": final_name,
                }
                col_missing.append(missing_entry)
                all_missing.append(missing_entry)

        # Apply metadata if present
        if matched > 0:
            _apply_collection_metadata(section, final_name, col_data)

        results.append({
            "original_name": col_name,
            "final_name": final_name,
            "name_changed": final_name != col_name,
            "total_items": len(items),
            "matched": matched,
            "missing": missing,
        })

        logger.info(
            "Imported collection '%s' (%s): %d matched, %d missing",
            final_name,
            target_library,
            matched,
            missing,
        )

    # Persist missing items
    _record_import_missing_items(import_name, all_missing)

    return {"collections": results, "import_name": import_name}


# ------------------------------------------------------------------
# Import helpers
# ------------------------------------------------------------------

def _resolve_collection_name(name: str, existing: set[str]) -> str:
    # Resolve collection name conflicts by appending (2), (3), etc.
    if name not in existing:
        return name
    counter = 2
    while f"{name} ({counter})" in existing:
        counter += 1
    return f"{name} ({counter})"


def _match_item(item_data: dict[str, Any], guid_map: dict, section) -> Any:
    # Try to match an import item to a Plex library item
    item_type = item_data.get("type", "movie")
    title = item_data["title"]
    year = item_data.get("year")
    imdb_id = item_data.get("imdb_id")
    tmdb_id = item_data.get("tmdb_id")
    tvdb_id = item_data.get("tvdb_id")

    if item_type == "movie":
        return find_movie(guid_map, section, title, year, imdb_id=imdb_id, tmdb_id=tmdb_id)

    if item_type == "show":
        return find_show(
            guid_map, section, title, year,
            tvdb_id=tvdb_id, tmdb_id=tmdb_id, imdb_id=imdb_id,
        )

    if item_type in ("season", "episode"):
        # Find the parent show first
        # IDs are show-level (from export), but year is the episode/season year,
        # not the show's debut year, so omit it to avoid mismatches on title fallback
        parent_title = item_data.get("parent_title") or title
        show = find_show(
            guid_map, section, parent_title, None,
            tvdb_id=tvdb_id, tmdb_id=tmdb_id, imdb_id=imdb_id,
        )
        if not show:
            return None

        season_num = item_data.get("season_number")
        if season_num is None:
            return None

        # Find the season
        try:
            season = show.season(season_num)
        except Exception:
            return None

        if item_type == "season":
            return season

        # Find the episode
        episode_num = item_data.get("episode_number")
        if episode_num is None:
            return None
        try:
            return season.episode(episode_num)
        except Exception:
            return None

    return None


def _apply_collection_metadata(section, collection_name: str, col_data: dict[str, Any]) -> None:
    # Apply metadata (summary, labels, sort order) to an imported collection
    try:
        collection = None
        for col in section.collections():
            if col.title == collection_name:
                collection = col
                break

        if not collection:
            return

        summary = col_data.get("summary")
        if summary:
            collection.editSummary(summary)

        labels = col_data.get("labels", [])
        for label in labels:
            collection.addLabel(label)

        sort_order = col_data.get("sort_order")
        sort_map = {"release": 0, "alpha": 1, "custom": 2}
        if sort_order and sort_order in sort_map:
            collection.sortUpdate(sort=sort_map[sort_order])

    except Exception as e:
        logger.warning("Failed to apply metadata to '%s': %s", collection_name, e)


def _record_import_missing_items(
    import_name: str,
    missing_items: list[dict[str, Any]],
) -> None:
    # Persist missing items from an import to the database
    if not missing_items:
        return

    with get_session() as session:
        for m in missing_items:
            existing = session.query(ImportMissingItem).filter(
                ImportMissingItem.import_name == import_name,
                ImportMissingItem.plex_collection == m["plex_collection"],
                ImportMissingItem.title == m["title"],
                ImportMissingItem.year == m.get("year"),
            ).first()

            if existing:
                existing.last_seen = datetime.utcnow()
                existing.times_seen += 1
            else:
                row = ImportMissingItem(
                    import_name=import_name,
                    plex_library=m["plex_library"],
                    plex_collection=m["plex_collection"],
                    title=m["title"],
                    year=m.get("year"),
                    type=m.get("type", "movie"),
                    imdb_id=m.get("imdb_id"),
                    tmdb_id=m.get("tmdb_id"),
                    tvdb_id=m.get("tvdb_id"),
                    parent_title=m.get("parent_title"),
                    season_number=m.get("season_number"),
                    episode_number=m.get("episode_number"),
                    first_seen=datetime.utcnow(),
                    last_seen=datetime.utcnow(),
                    times_seen=1,
                )
                session.add(row)

        session.commit()


def get_import_missing_items(import_name: Optional[str] = None) -> list[dict[str, Any]]:
    # Retrieve persisted missing items, optionally filtered by import name
    with get_session() as session:
        query = session.query(ImportMissingItem)
        if import_name:
            query = query.filter(ImportMissingItem.import_name == import_name)
        query = query.order_by(ImportMissingItem.import_name, ImportMissingItem.title)

        return [
            {
                "id": row.id,
                "import_name": row.import_name,
                "plex_library": row.plex_library,
                "plex_collection": row.plex_collection,
                "title": row.title,
                "year": row.year,
                "type": row.type,
                "imdb_id": row.imdb_id,
                "tmdb_id": row.tmdb_id,
                "tvdb_id": row.tvdb_id,
                "parent_title": row.parent_title,
                "season_number": row.season_number,
                "episode_number": row.episode_number,
                "first_seen": row.first_seen.isoformat() if row.first_seen else None,
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
                "times_seen": row.times_seen,
            }
            for row in query.all()
        ]


def clear_import_missing_items(import_name: str) -> int:
    # Clear missing items for a specific import. Returns count deleted.
    with get_session() as session:
        count = session.query(ImportMissingItem).filter(
            ImportMissingItem.import_name == import_name,
        ).delete()
        session.commit()
        return count
