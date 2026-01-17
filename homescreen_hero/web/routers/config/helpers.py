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
