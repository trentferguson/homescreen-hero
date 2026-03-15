from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import requests
from plexapi.server import PlexServer

from .config.schema import AppConfig
from .integrations.plex_client import get_plex_account, get_all_plex_users, get_library_collections

logger = logging.getLogger(__name__)

LABEL_PREFIX = "Hsh-hide-"  # I hate having to capitalize, but Plex likes to auto-capitalize. Yay.


def sync_all_user_filters(config: AppConfig) -> None:
    # Make sure every user's sharing settings include their hsh-hide label exclusion.
    # Users not excluded by any group get their hsh filters cleaned instead.
    all_users = get_all_plex_users(config)
    account = get_plex_account(config)

    # Build set of usernames that are excluded by at least one group's targeting
    # (i.e. users NOT in a group's target_users list)
    groups_with_targeting = [g for g in config.groups if g.target_users is not None]
    excluded_usernames: set = set()
    if groups_with_targeting:
        for group in groups_with_targeting:
            target_lower = {u.lower() for u in group.target_users}
            for u in all_users:
                if (u["username"].lower() not in target_lower
                        and u["title"].lower() not in target_lower):
                    excluded_usernames.add(u["username"].lower())

    for user in all_users:
        if user["is_admin"]:
            continue

        username = user["username"]
        user_id = user["id"]
        needs_filter = username.lower() in excluded_usernames

        try:
            current = _read_current_filters(account, username, user_id)
            if current is None:
                logger.warning(f"Could not read filters for {username}, skipping to avoid data loss")
                continue

            if needs_filter:
                label = _make_hide_label(username)
                new_movies = _merge_hsh_filter(current.get("filterMovies", ""), [label])
                new_tv = _merge_hsh_filter(current.get("filterTelevision", ""), [label])
            else:
                new_movies = _clean_hsh_filter(current.get("filterMovies", ""))
                new_tv = _clean_hsh_filter(current.get("filterTelevision", ""))

            existing_music = current.get("filterMusic", "")
            if _set_user_filter(account, username, user_id, new_movies, new_tv, existing_music):
                action = "Set" if needs_filter else "Cleaned"
                logger.info(f"{action} filters for {username}")
            else:
                logger.warning(f"Failed to sync filters for {username} (id={user_id})")

        except Exception as e:
            logger.error(f"Error syncing filters for {username}: {e}")


def get_targetable_users(config: AppConfig) -> List[Dict[str, Any]]:
    # Return all Plex users (shared and managed) available for targeting.
    return get_all_plex_users(config)


def clear_all_targeting(config: AppConfig) -> Dict[str, int]:
    # Remove all Hsh-hide-* labels from every collection and clean user filter settings.
    from .integrations.plex_client import get_plex_server

    server = get_plex_server(config)
    labels_removed = 0
    collections_cleaned = 0

    for lib in config.plex.libraries:
        if not lib.enabled:
            continue
        try:
            colls = get_library_collections(server, lib.name)
            for name, coll in colls.items():
                hsh_labels = [
                    label.tag for label in coll.labels
                    if label.tag.lower().startswith(LABEL_PREFIX.lower())
                ]
                if hsh_labels:
                    for tag in hsh_labels:
                        coll.removeLabel(tag)
                        labels_removed += 1
                    collections_cleaned += 1
                    logger.debug(f"Cleared {len(hsh_labels)} labels from '{name}'")
        except Exception as e:
            logger.error(f"Failed to clear labels from '{lib.name}': {e}")

    # Clean user filter settings, preserving any non-hsh filters
    filters_cleaned = 0
    account = get_plex_account(config)
    all_users = get_all_plex_users(config)

    for user in all_users:
        if user["is_admin"]:
            continue
        try:
            username = user["username"]
            user_id = user["id"]

            current = _read_current_filters(account, username, user_id)
            if current is None:
                logger.warning(f"Could not read filters for {username}, skipping to avoid data loss")
                continue

            clean_movies = _clean_hsh_filter(current.get("filterMovies", ""))
            clean_tv = _clean_hsh_filter(current.get("filterTelevision", ""))
            existing_music = current.get("filterMusic", "")

            if _set_user_filter(account, username, user_id, clean_movies, clean_tv, existing_music):
                filters_cleaned += 1
                logger.info(f"Cleared filters for {username}")
            else:
                logger.warning(f"Failed to clear filters for {username}")
        except Exception as e:
            logger.error(f"Error clearing filters for {user['username']}: {e}")

    logger.info(
        f"Clear all targeting: {labels_removed} labels removed from "
        f"{collections_cleaned} collections, {filters_cleaned} user filters cleaned"
    )
    return {
        "labels_removed": labels_removed,
        "collections_cleaned": collections_cleaned,
        "filters_cleaned": filters_cleaned,
    }


def apply_rotation_targeting(
    server: PlexServer,
    config: AppConfig,
    applied_collection_names: List[str],
    smart_group_collections: Optional[Dict[str, List[str]]] = None,
) -> None:
    # Apply user targeting for all groups that have target_users set.

    groups_with_targeting = [g for g in config.groups if g.target_users is not None]

    applied_set = set(applied_collection_names)

    all_collections: Dict[str, object] = {}
    for lib in config.plex.libraries:
        if lib.enabled:
            try:
                all_collections.update(get_library_collections(server, lib.name))
            except Exception as e:
                logger.error(f"Failed to fetch collections from '{lib.name}' for targeting: {e}")

    # Clean labels from collections that were removed from the homescreen
    from .db.history import get_last_rotation_collections
    previous = set(get_last_rotation_collections())
    removed_from_homescreen = previous - applied_set

    for name in removed_from_homescreen:
        coll = all_collections.get(name)
        if coll:
            _remove_hsh_labels(coll)

    # Clean labels from currently applied collections so they get a fresh set
    for name in applied_set:
        coll = all_collections.get(name)
        if coll:
            _remove_hsh_labels(coll)

    if not groups_with_targeting:
        return

    # Apply targeting per group
    all_users = get_all_plex_users(config)

    for group in groups_with_targeting:
        # Get this collections from the gorup
        if group.smart and smart_group_collections:
            pool = smart_group_collections.get(group.name, [])
        else:
            pool = group.collections

        # Filter to only collections that were actually applied this rotation
        targeted_collections = []
        for name in pool:
            if name in applied_set:
                coll = all_collections.get(name)
                if coll:
                    targeted_collections.append(coll)

        if not targeted_collections:
            continue

        logger.info(
            f"Applying user targeting for group '{group.name}': "
            f"{len(targeted_collections)} collections targeted to {group.target_users}"
        )

        target_lower = {u.lower() for u in group.target_users}
        excluded = [
            u for u in all_users
            if u["username"].lower() not in target_lower
            and u["title"].lower() not in target_lower
        ]

        for coll in targeted_collections:
            _add_exclusion_labels(coll, excluded)


def _make_hide_label(username: str) -> str:
    # Build the exclusion label for a username
    return f"{LABEL_PREFIX}{username}"


def _add_exclusion_labels(collection, excluded_users: List[Dict[str, Any]]) -> None:
    # Add hsh-hide-{username} labels to a collection for each excluded user
    existing_labels = {label.tag.lower() for label in collection.labels}

    for user in excluded_users:
        label = _make_hide_label(user["username"])
        if label.lower() not in existing_labels:
            logger.debug(f"Adding label '{label}' to '{collection.title}'")
            collection.addLabel(label)


def _remove_hsh_labels(collection) -> None:
    # Strip all Hsh-hide-* labels from a collection, leaving other labels intact
    for label in collection.labels:
        if label.tag.lower().startswith(LABEL_PREFIX.lower()):
            logger.debug(f"Removing label '{label.tag}' from '{collection.title}'")
            collection.removeLabel(label.tag)


def _read_current_filters(account, username: str, user_id: int) -> Optional[Dict[str, str]]:
    # Read current filter settings from the V2 API.
    # Tries invitedEmail first, falls back to invitedId for managed users.
    base_url = (
        "https://clients.plex.tv/api/v2/sharing_settings"
        "?X-Plex-Product=Homescreen+Hero"
        "&X-Plex-Client-Identifier=homescreen-hero"
    )
    headers = {"Accept": "application/json", "X-Plex-Token": account._token}

    for param in [f"invitedEmail={username}", f"invitedId={user_id}"]:
        try:
            resp = requests.get(f"{base_url}&{param}", headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "filterMovies": data.get("filterMovies", "") or "",
                    "filterTelevision": data.get("filterTelevision", "") or "",
                    "filterMusic": data.get("filterMusic", "") or "",
                }
        except Exception as e:
            logger.debug(f"V2 read failed for {username} ({param}): {e}")

    logger.warning(f"Could not read filters for {username} (id={user_id}) via V2 API")
    return None


def _merge_hsh_filter(existing_filter: str, hsh_labels: List[str]) -> str:
    # Merge our hsh labels into an existing filter string, preserving non-hsh filters.
    # Not sure how many people are using labels, but just to be safe lol

    if not existing_filter:
        # No existing filter, just create the label exclusion
        return f"label!={','.join(hsh_labels)}"

    parts = existing_filter.split("&")
    label_part = None
    other_parts = []

    for part in parts:
        if part.startswith("label!="):
            label_part = part
        else:
            other_parts.append(part)

    # Extract existing non-hsh specific labels
    existing_labels = []
    if label_part:
        label_values = label_part[len("label!="):]
        for lbl in label_values.split(","):
            lbl = lbl.strip()
            if lbl and not lbl.lower().startswith(LABEL_PREFIX.lower()):
                existing_labels.append(lbl)

    # Combine non-hsh labels with new hsh labels
    all_labels = existing_labels + hsh_labels
    new_label_part = f"label!={','.join(all_labels)}"

    all_parts = other_parts + [new_label_part]
    return "&".join(all_parts)


def _clean_hsh_filter(existing_filter: str) -> str:
    # Remove all hsh labels from a filter string, keeping everything else
    if not existing_filter:
        return ""

    parts = existing_filter.split("&")
    result_parts = []

    for part in parts:
        if part.startswith("label!="):
            label_values = part[len("label!="):]
            non_hsh = [
                lbl.strip() for lbl in label_values.split(",")
                if lbl.strip() and not lbl.strip().lower().startswith(LABEL_PREFIX.lower())
            ]
            if non_hsh:
                result_parts.append(f"label!={','.join(non_hsh)}")
        else:
            result_parts.append(part)

    return "&".join(result_parts)


def _set_user_filter(
    account, username: str, user_id: int,
    filter_movies: str, filter_tv: str, filter_music: str = "",
) -> bool:
    # Set user filter settings via V2 API.
    # Tries invitedEmail first, falls back to invitedId for managed users.
    url = (
        "https://clients.plex.tv/api/v2/sharing_settings"
        "?X-Plex-Product=Homescreen+Hero"
        "&X-Plex-Client-Identifier=homescreen-hero"
    )
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Plex-Token": account._token,
    }
    settings = {
        "filterMovies": filter_movies,
        "filterTelevision": filter_tv,
        "filterMusic": filter_music,
    }

    # Try invitedEmail first (works for friends/shared users)
    for payload in [
        {"settings": settings, "invitedEmail": username},
        {"settings": settings, "invitedId": user_id},
    ]:
        try:
            resp = requests.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                return True
        except Exception as e:
            logger.debug(f"V2 write failed for {username}: {e}")

    return False
