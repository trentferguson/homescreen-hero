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
            current = _read_current_filters(account, user)

            if needs_filter:
                label = _make_hide_label(username)
                new_movies = _merge_hsh_filter(current.get("filterMovies", ""), [label])
                new_tv = _merge_hsh_filter(current.get("filterTelevision", ""), [label])
            else:
                # No targeting applies to this user, clean any leftover hsh filters
                new_movies = _clean_hsh_filter(current.get("filterMovies", ""))
                new_tv = _clean_hsh_filter(current.get("filterTelevision", ""))

            # Always push - the read can return stale data so skip-if-unchanged is unreliable
            success = False
            if username and username != user.get("title", ""):
                success = _set_user_filter_v2(account, username, new_movies, new_tv)
                if success:
                    action = "Set" if needs_filter else "Cleaned"
                    logger.info(f"{action} filters for {username} via V2 API")
                    continue

            # V1 fallback for managed users
            success = _set_user_filter_v1(account, user_id, new_movies, new_tv)
            if success:
                action = "Set" if needs_filter else "Cleaned"
                logger.info(f"{action} filters for {username} (id={user_id}) via V1 API")
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

    # Clean user filter settings. We read current filters to preserve non-hsh filters,
    # but always push the cleaned result (no skip-if-unchanged) because the read can
    # return stale/empty data while Plex still has the restriction applied.
    filters_cleaned = 0
    account = get_plex_account(config)
    all_users = get_all_plex_users(config)

    for user in all_users:
        if user["is_admin"]:
            continue
        try:
            username = user["username"]
            user_id = user["id"]

            current = _read_current_filters(account, user)
            clean_movies = _clean_hsh_filter(current.get("filterMovies", ""))
            clean_tv = _clean_hsh_filter(current.get("filterTelevision", ""))

            success = False
            if username and username != user.get("title", ""):
                success = _set_user_filter_v2(account, username, clean_movies, clean_tv)

            if not success:
                success = _set_user_filter_v1(account, user_id, clean_movies, clean_tv)

            if success:
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


def _read_current_filters(account, user: Dict[str, Any]) -> Dict[str, str]:
    # Read a users current filter settings from Plex
    try:
        user_sharing = account.user(user["title"])
        result = {"filterMovies": "", "filterTelevision": ""}
        for section in user_sharing.servers[0].sections():
            if hasattr(section, "filterMovies") and section.filterMovies:
                result["filterMovies"] = section.filterMovies
            if hasattr(section, "filterTelevision") and section.filterTelevision:
                result["filterTelevision"] = section.filterTelevision
        return result
    except Exception as e:
        logger.debug(f"Could not read current filters for {user['username']}: {e}")
        return {"filterMovies": "", "filterTelevision": ""}


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


def _set_user_filter_v2(
    account, username: str, filter_movies: str, filter_tv: str
) -> bool:
    # V2 API: POST clients.plex.tv/api/v2/sharing_settings (doesn't work for shared users, I'm pretty sure)
    url = (
        "https://clients.plex.tv/api/v2/sharing_settings"
        f"?X-Plex-Product=Homescreen+Hero"
        f"&X-Plex-Client-Identifier=homescreen-hero"
        f"&X-Plex-Token={account._token}"
    )

    payload = {
        "settings": {
            "filterMovies": filter_movies,
            "filterTelevision": filter_tv,
            "filterMusic": "",
        },
        "invitedEmail": username,
    }

    headers = {"Accept": "application/json", "Content-Type": "application/json"}

    try:
        resp = requests.post(url, json=payload, headers=headers)
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.debug(f"V2 API failed for {username}: {e}")
        return False


def _set_user_filter_v1(
    account, user_id: int, filter_movies: str, filter_tv: str
) -> bool:
    # V1 API: PUT plex.tv/api/users/{id} (fallback to V1 for managed users)
    url = f"https://plex.tv/api/users/{user_id}"

    params = {
        "X-Plex-Token": account._token,
        "X-Plex-Product": "Homescreen Hero",
        "X-Plex-Client-Identifier": "homescreen-hero",
        "filterMovies": filter_movies,
        "filterTelevision": filter_tv,
    }

    headers = {"Accept": "application/json"}

    try:
        resp = requests.put(url, params=params, headers=headers)
        return resp.status_code in (200, 201)
    except Exception as e:
        logger.debug(f"V1 API failed for user_id={user_id}: {e}")
        return False
