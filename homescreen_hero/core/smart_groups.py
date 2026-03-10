from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from .config.schema import AppConfig, SmartGroupRule
from .integrations.plex_client import get_collection_labels, get_collection_item_count
from .poster_proxy import build_collection_poster_url

logger = logging.getLogger(__name__)


@dataclass
class CollectionMetadata:
    name: str
    source: str        # "plex", "trakt", "letterboxd", "mdblist", "anilist", "mal"
    library: str
    labels: list = field(default_factory=list)
    item_count: int = 0
    sort_title: str = ""
    poster_url: Optional[str] = None


def build_collection_metadata(server, config: AppConfig) -> List[CollectionMetadata]:
    # Build metadata for all known collections from Plex + integration sources.
    # Third-party sources that also exist as Plex collections get their
    # labels/item_count enriched from Plex but keep the original source tag.
    metadata: List[CollectionMetadata] = []

    # Collect third-party source names so we can attribute them correctly
    third_party: dict[str, tuple[str, str]] = {}  # name -> (source, library)

    if config.trakt and config.trakt.enabled and config.trakt.sources:
        for src in config.trakt.sources:
            third_party[src.name] = ("trakt", src.plex_library)

    if config.letterboxd and config.letterboxd.sources:
        for src in config.letterboxd.sources:
            third_party[src.name] = ("letterboxd", src.plex_library)

    if config.mdblist and config.mdblist.enabled and config.mdblist.sources:
        for src in config.mdblist.sources:
            third_party[src.name] = ("mdblist", src.plex_library)

    if config.tmdb and config.tmdb.enabled and config.tmdb.sources:
        for src in config.tmdb.sources:
            third_party[src.name] = ("tmdb", src.plex_library)

    if config.anilist and config.anilist.sources:
        for src in config.anilist.sources:
            third_party[src.name] = ("anilist", src.plex_library)

    if config.mal and config.mal.enabled and config.mal.sources:
        for src in config.mal.sources:
            third_party[src.name] = ("mal", src.plex_library)

    # Iterate Plex libraries and build metadata for each collection
    seen_names: set = set()
    for section in server.library.sections():
        try:
            for coll in section.collections():
                name = coll.title
                if name in seen_names:
                    continue
                seen_names.add(name)

                # Determine source — third-party takes priority over "plex"
                if name in third_party:
                    source, _ = third_party[name]
                else:
                    source = "plex"

                metadata.append(CollectionMetadata(
                    name=name,
                    source=source,
                    library=section.title,
                    labels=get_collection_labels(coll),
                    item_count=get_collection_item_count(coll),
                    sort_title=getattr(coll, "titleSort", "") or "",
                    poster_url=build_collection_poster_url(server, coll),
                ))
        except Exception:
            logger.warning("Failed to fetch collections from library '%s'", section.title)
            continue

    # Add third-party sources that don't exist in Plex yet (not synced or sync failed)
    for name, (source, library) in third_party.items():
        if name not in seen_names:
            metadata.append(CollectionMetadata(
                name=name,
                source=source,
                library=library,
                labels=[],
                item_count=0,
            ))

    logger.debug("Built metadata for %d collections", len(metadata))
    return metadata


def _matches_rule(rule: SmartGroupRule, coll: CollectionMetadata) -> bool:
    # Evaluate a single rule against one collection. Returns True if the collection matches.
    f = rule.field
    op = rule.operator
    vals = rule.values

    if f == "label":
        coll_labels_lower = {l.lower() for l in coll.labels}
        rule_labels_lower = {str(v).lower() for v in vals}
        if op == "includes":
            # Collection has at least one of the specified labels
            return bool(coll_labels_lower & rule_labels_lower)
        elif op == "excludes":
            # Collection has none of the specified labels
            return not bool(coll_labels_lower & rule_labels_lower)

    elif f == "source":
        rule_sources = {str(v).lower() for v in vals}
        if op == "is":
            return coll.source.lower() in rule_sources
        elif op == "is_not":
            return coll.source.lower() not in rule_sources

    elif f == "library":
        rule_libs = {str(v).lower() for v in vals}
        if op == "is":
            return coll.library.lower() in rule_libs
        elif op == "is_not":
            return coll.library.lower() not in rule_libs

    elif f == "name":
        coll_name_lower = coll.name.lower()
        rule_strs = [str(v).lower() for v in vals]
        if op == "contains":
            # Collection name contains at least one of the specified strings
            return any(s in coll_name_lower for s in rule_strs)
        elif op == "not_contains":
            # Collection name contains none of the specified strings
            return not any(s in coll_name_lower for s in rule_strs)

    elif f == "sort_title":
        sort_title_lower = coll.sort_title.lower()
        rule_strs = [str(v).lower() for v in vals]
        if op == "contains":
            return any(s in sort_title_lower for s in rule_strs)
        elif op == "not_contains":
            return not any(s in sort_title_lower for s in rule_strs)

    elif f == "item_count":
        threshold = int(vals[0]) if vals else 0
        if op == "gte":
            return coll.item_count >= threshold
        elif op == "lte":
            return coll.item_count <= threshold

    # Unknown field/operator combo — shouldn't happen if schema validation passes
    logger.warning("Unknown rule: field=%s, operator=%s", f, op)
    return False


def _rule_has_values(rule: SmartGroupRule) -> bool:
    # Only rules with meaningful values should affect matching.
    # Empty/incomplete rules are ignored so smart previews can start from all collections.
    if not rule.values:
        return False

    if rule.field == "item_count":
        return True

    return any(str(v).strip() for v in rule.values)


def resolve_smart_rules(
    rules: List[SmartGroupRule],
    metadata: List[CollectionMetadata],
) -> List[str]:
    # Evaluate rules against all collections. Rules are ANDed together.
    # Returns list of matching collection names.
    active_rules = [rule for rule in rules if _rule_has_values(rule)]
    if not active_rules:
        return [coll.name for coll in metadata]

    matching = []
    for coll in metadata:
        if all(_matches_rule(rule, coll) for rule in active_rules):
            matching.append(coll.name)

    logger.debug("Smart rules resolved to %d collections: %s", len(matching), matching)
    return matching


def get_available_filter_options(
    server,
    config: AppConfig,
) -> dict:
    # Return all available values for smart group rule builder dropdowns.
    metadata = build_collection_metadata(server, config)

    # Collect unique labels across all collections
    all_labels: set = set()
    for coll in metadata:
        all_labels.update(coll.labels)

    # Collect unique sources
    all_sources: set = set()
    for coll in metadata:
        all_sources.add(coll.source)

    # Collect unique libraries
    all_libraries: set = set()
    for coll in metadata:
        all_libraries.add(coll.library)

    return {
        "labels": sorted(all_labels),
        "sources": sorted(all_sources),
        "libraries": sorted(all_libraries),
    }
