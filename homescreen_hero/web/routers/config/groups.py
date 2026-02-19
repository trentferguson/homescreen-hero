from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends

from homescreen_hero.core.auth import CurrentUser, get_current_user, require_admin
from homescreen_hero.core.config.loader import (
    CONFIG_ENV_VAR,
    get_config_path,
    load_config,
)
from homescreen_hero.core.config.schema import (
    CollectionGroupConfig,
    TraktSettings,
    LetterboxdSettings,
    MDBListSettings,
    AniListSettings,
    MALSettings,
)
from homescreen_hero.core.integrations.plex_client import get_plex_server

from .helpers import load_config_mapping, save_config_mapping, load_group_list
from .schemas import (
    ConfigSaveResponse,
    CollectionGroupPayload,
    GroupValidationResult,
    CollectionSourcesResponse,
    GroupReorderRequest,
)

router = APIRouter()


# ========================================================================
# COLLECTION GROUPS CRUD
# ========================================================================

@router.get("/groups", response_model=list[CollectionGroupConfig])
def list_groups(current_user: CurrentUser = Depends(require_admin)) -> list[CollectionGroupConfig]:
    # Return list of all configured collection groups
    try:
        config = load_config()
        return config.groups
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/groups", response_model=ConfigSaveResponse)
def create_group(
    payload: CollectionGroupPayload,
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Append new collection group to config.yaml
    try:
        data = load_config_mapping()
        groups = load_group_list(data)

        new_group = payload.model_dump(exclude_none=True)
        # Place new groups at the end of the display order
        max_order = max((g.get("display_order", 0) for g in groups), default=-1)
        new_group["display_order"] = max_order + 1
        groups.append(new_group)
        config_path = get_config_path()
        save_config_mapping({**data, "groups": groups})

        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Group '{payload.name}' added.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/groups/{index}", response_model=ConfigSaveResponse)
def update_group(
    index: int,
    payload: CollectionGroupPayload,
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Replace existing collection group at given index in config.yaml
    try:
        data = load_config_mapping()
        groups = load_group_list(data)

        if index < 0 or index >= len(groups):
            raise HTTPException(status_code=404, detail="Group not found")

        groups[index] = payload.model_dump(exclude_none=True)
        config_path = get_config_path()
        save_config_mapping({**data, "groups": groups})

        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Group '{payload.name}' updated.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/groups/{index}", response_model=ConfigSaveResponse)
def delete_group(
    index: int,
    current_user: CurrentUser = Depends(require_admin)
) -> ConfigSaveResponse:
    # Remove collection group at given index from config.yaml
    try:
        data = load_config_mapping()
        groups = load_group_list(data)

        if index < 0 or index >= len(groups):
            raise HTTPException(status_code=404, detail="Group not found")

        removed = groups.pop(index)
        config_path = get_config_path()
        save_config_mapping({**data, "groups": groups})

        name = removed.get("name") if isinstance(removed, dict) else None
        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Group '{name or index}' deleted.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/groups/reorder", response_model=ConfigSaveResponse)
def reorder_groups(
    payload: GroupReorderRequest,
    current_user: CurrentUser = Depends(require_admin),
) -> ConfigSaveResponse:
    # Update display_order for each group based on the provided name ordering
    try:
        data = load_config_mapping()
        groups = load_group_list(data)

        # Build a name->index lookup for the requested order
        name_to_order = {name: i for i, name in enumerate(payload.ordered_group_names)}

        # Update display_order on each group
        for group in groups:
            group_name = group.get("name", "")
            if group_name in name_to_order:
                group["display_order"] = name_to_order[group_name]

        config_path = get_config_path()
        save_config_mapping({**data, "groups": groups})

        return ConfigSaveResponse(
            ok=True,
            path=str(config_path),
            env_override=CONFIG_ENV_VAR in os.environ,
            message=f"Updated display order for {len(name_to_order)} groups.",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# GROUP SOURCES (available collections for groups)
# ========================================================================

@router.get("/group-sources", response_model=CollectionSourcesResponse)
def list_group_sources(current_user: CurrentUser = Depends(require_admin)) -> CollectionSourcesResponse:
    # Return list of all available Plex collections and configured Trakt/Letterboxd sources
    try:
        config = load_config()
        server = get_plex_server(config)

        plex_sources: list[CollectionSourcesResponse.CollectionSource] = []
        for section in server.library.sections():
            try:
                for col in section.collections():
                    plex_sources.append(
                        CollectionSourcesResponse.CollectionSource(
                            name=col.title,
                            source="plex",
                            detail=section.title,
                        )
                    )
            except Exception:  # pragma: no cover - defensive
                continue

        trakt_sources: list[CollectionSourcesResponse.CollectionSource] = []
        trakt_cfg: Optional[TraktSettings] = getattr(config, "trakt", None)
        if trakt_cfg and getattr(trakt_cfg, "sources", None):
            for src in trakt_cfg.sources:
                trakt_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="trakt",
                        detail=src.plex_library or src.url,
                    )
                )

        letterboxd_sources: list[CollectionSourcesResponse.CollectionSource] = []
        letterboxd_cfg: Optional[LetterboxdSettings] = getattr(config, "letterboxd", None)
        if letterboxd_cfg and getattr(letterboxd_cfg, "sources", None):
            for src in letterboxd_cfg.sources:
                letterboxd_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="letterboxd",
                        detail=src.plex_library or src.url,
                    )
                )

        mdblist_sources: list[CollectionSourcesResponse.CollectionSource] = []
        mdblist_cfg: Optional[MDBListSettings] = getattr(config, "mdblist", None)
        if mdblist_cfg and getattr(mdblist_cfg, "sources", None):
            for src in mdblist_cfg.sources:
                mdblist_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="mdblist",
                        detail=src.plex_library or src.url,
                    )
                )

        anilist_sources: list[CollectionSourcesResponse.CollectionSource] = []
        anilist_cfg: Optional[AniListSettings] = getattr(config, "anilist", None)
        if anilist_cfg and getattr(anilist_cfg, "sources", None):
            for src in anilist_cfg.sources:
                anilist_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="anilist",
                        detail=src.plex_library or src.url,
                    )
                )

        mal_sources: list[CollectionSourcesResponse.CollectionSource] = []
        mal_cfg: Optional[MALSettings] = getattr(config, "mal", None)
        if mal_cfg and getattr(mal_cfg, "sources", None):
            for src in mal_cfg.sources:
                mal_sources.append(
                    CollectionSourcesResponse.CollectionSource(
                        name=src.name,
                        source="mal",
                        detail=src.plex_library or src.url,
                    )
                )

        # Plex collections created by third-party sync duplicate those sources.
        # Filter them out so the UI only shows the authoritative source.
        third_party_names = {s.name for s in trakt_sources + letterboxd_sources + mdblist_sources + anilist_sources + mal_sources}
        plex_sources = [s for s in plex_sources if s.name not in third_party_names]

        return CollectionSourcesResponse(
            plex=plex_sources,
            trakt=trakt_sources,
            letterboxd=letterboxd_sources,
            mdblist=mdblist_sources,
            anilist=anilist_sources,
            mal=mal_sources,
        )
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ========================================================================
# VALIDATION
# ========================================================================

@router.get("/validate", response_model=List[GroupValidationResult])
def validate_config_groups(current_user: CurrentUser = Depends(require_admin)) -> List[GroupValidationResult]:
    # Validate configured collection groups against Plex collections
    config = load_config()
    server = get_plex_server(config)

    # Build a map of all Plex collections by name for cheap lookup
    all_collections_by_name: dict[str, bool] = {}
    for section in server.library.sections():
        try:
            for col in section.collections():
                all_collections_by_name[col.title] = True
        except Exception:
            continue

    results: list[GroupValidationResult] = []
    for group in getattr(config, "groups", []):
        group_name = getattr(group, "name", "Unnamed")
        collections = list(getattr(group, "collections", []))

        issues: list[str] = []
        duplicates: list[str] = []

        seen = set()
        for collection in collections:
            if collection in seen and collection not in duplicates:
                duplicates.append(collection)
            seen.add(collection)

        if duplicates:
            issues.append(f"Duplicate collections in group: {', '.join(duplicates)}")

        missing = [c for c in collections if c not in all_collections_by_name]
        if missing:
            issues.append(f"Missing in Plex: {', '.join(missing)}")

        results.append(
            GroupValidationResult(
                name=group_name,
                collections=collections,
                ok=not issues,
                issues=issues,
            )
        )

    return results
