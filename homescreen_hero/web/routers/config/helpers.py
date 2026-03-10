from __future__ import annotations

import yaml

from homescreen_hero.core.config.loader import (
    load_config_text,
    save_config_text,
)


def load_config_mapping() -> dict:
    # Load and parse the config file as a dictionary
    raw_text = load_config_text()
    data = yaml.safe_load(raw_text) or {}
    if not isinstance(data, dict):
        raise ValueError("Config file must contain a YAML mapping at the root")

    return data


def save_config_mapping(data: dict) -> None:
    # Serialize and save the config mapping
    serialized = yaml.safe_dump(data, sort_keys=False)
    save_config_text(serialized)


def load_group_list(data: dict) -> list[dict]:
    # Extract the list of groups from config mapping
    groups = data.get("groups") or []
    if not isinstance(groups, list):
        raise ValueError("config.groups must be a list")
    return list(groups)


def load_trakt_sources(data: dict) -> list[dict]:
    # Extract the list of Trakt sources from config mapping
    trakt_section = data.get("trakt")
    if trakt_section and not isinstance(trakt_section, dict):
        raise ValueError("config.trakt must be a mapping if present")

    sources = trakt_section.get("sources") if isinstance(trakt_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.trakt.sources must be a list")

    return list(sources or [])


def load_letterboxd_sources(data: dict) -> list[dict]:
    # Extract the list of Letterboxd sources from config mapping
    letterboxd_section = data.get("letterboxd")
    if letterboxd_section and not isinstance(letterboxd_section, dict):
        raise ValueError("config.letterboxd must be a mapping if present")

    sources = letterboxd_section.get("sources") if isinstance(letterboxd_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.letterboxd.sources must be a list")

    return list(sources or [])


def load_mdblist_sources(data: dict) -> list[dict]:
    # Extract the list of MDBList sources from config mapping
    mdblist_section = data.get("mdblist")
    if mdblist_section and not isinstance(mdblist_section, dict):
        raise ValueError("config.mdblist must be a mapping if present")

    sources = mdblist_section.get("sources") if isinstance(mdblist_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.mdblist.sources must be a list")

    return list(sources or [])


def load_tmdb_sources(data: dict) -> list[dict]:
    # Extract the list of TMDb sources from config mapping
    tmdb_section = data.get("tmdb")
    if tmdb_section and not isinstance(tmdb_section, dict):
        raise ValueError("config.tmdb must be a mapping if present")

    sources = tmdb_section.get("sources") if isinstance(tmdb_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.tmdb.sources must be a list")

    return list(sources or [])


def load_anilist_sources(data: dict) -> list[dict]:
    # Extract the list of AniList sources from config mapping
    anilist_section = data.get("anilist")
    if anilist_section and not isinstance(anilist_section, dict):
        raise ValueError("config.anilist must be a mapping if present")

    sources = anilist_section.get("sources") if isinstance(anilist_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.anilist.sources must be a list")

    return list(sources or [])


def load_mal_sources(data: dict) -> list[dict]:
    # Extract the list of MAL sources from config mapping
    mal_section = data.get("mal")
    if mal_section and not isinstance(mal_section, dict):
        raise ValueError("config.mal must be a mapping if present")

    sources = mal_section.get("sources") if isinstance(mal_section, dict) else []
    if sources and not isinstance(sources, list):
        raise ValueError("config.mal.sources must be a list")

    return list(sources or [])


def get_all_source_names(data: dict) -> set[str]:
    # Collect all source names across integrations (used for duplicate validation)
    names: set[str] = set()
    for section_key in ("trakt", "letterboxd", "mdblist", "tmdb", "anilist", "mal"):
        section = data.get(section_key)
        if not isinstance(section, dict):
            continue
        sources = section.get("sources") or []
        if not isinstance(sources, list):
            continue
        for s in sources:
            if isinstance(s, dict) and s.get("name"):
                names.add(s["name"])
    return names
