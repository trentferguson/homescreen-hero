from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from homescreen_hero.core.auth import CurrentUser, require_admin
from homescreen_hero.core.collection_io import (
    apply_import,
    clear_import_missing_items,
    encode_share_code,
    export_collections,
    get_import_missing_items,
    parse_import_data,
    preview_import,
)
from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.integrations.plex_client import get_plex_server

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/collections/io", tags=["collection-io"])

MAX_IMPORT_SIZE = 5 * 1024 * 1024  # 5MB


# ------------------------------------------------------------------
# Request / Response models
# ------------------------------------------------------------------

class ExportRequest(BaseModel):
    library: str
    collections: List[str]
    include_metadata: bool = False


class ShareCodeResponse(BaseModel):
    share_code: str


class ImportShareCodeRequest(BaseModel):
    share_code: str
    target_library: str


class ImportApplyShareCodeRequest(BaseModel):
    share_code: str
    target_library: str
    import_name: Optional[str] = None
    selected_collections: Optional[List[str]] = None


class CollectionImportResult(BaseModel):
    original_name: str
    final_name: str
    name_changed: bool
    total_items: int
    matched: int
    missing: int


class ImportPreviewResponse(BaseModel):
    collections: List[dict]


class ImportApplyResponse(BaseModel):
    collections: List[CollectionImportResult]
    import_name: str


class MissingItemsResponse(BaseModel):
    items: List[dict]
    count: int


class ClearMissingResponse(BaseModel):
    deleted: int


# ------------------------------------------------------------------
# Export endpoints
# ------------------------------------------------------------------

@router.post("/export")
def export_collections_json(
    request: ExportRequest,
    _current_user: CurrentUser = Depends(require_admin),
) -> dict:
    config = load_config()
    server = get_plex_server(config)

    try:
        result = export_collections(
            server,
            request.library,
            request.collections,
            include_metadata=request.include_metadata,
        )
    except Exception as e:
        logger.error("Export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    return result


@router.post("/export/share-code", response_model=ShareCodeResponse)
def export_share_code(
    request: ExportRequest,
    _current_user: CurrentUser = Depends(require_admin),
) -> ShareCodeResponse:
    config = load_config()
    server = get_plex_server(config)

    try:
        result = export_collections(
            server,
            request.library,
            request.collections,
            include_metadata=request.include_metadata,
        )
        # Remove errors from the share code payload (keep it clean for sharing)
        result.pop("errors", None)
        share_code = encode_share_code(result)
    except Exception as e:
        logger.error("Share code export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    return ShareCodeResponse(share_code=share_code)


# ------------------------------------------------------------------
# Import endpoints
# ------------------------------------------------------------------

@router.post("/import/preview", response_model=ImportPreviewResponse)
async def import_preview_file(
    target_library: str,
    file: UploadFile = File(...),
    _current_user: CurrentUser = Depends(require_admin),
) -> ImportPreviewResponse:
    content = await file.read()
    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    try:
        import_data = parse_import_data(file_content=content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid import file: {str(e)}")

    config = load_config()
    server = get_plex_server(config)

    try:
        result = preview_import(server, import_data, target_library)
    except Exception as e:
        logger.error("Import preview failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")

    return ImportPreviewResponse(collections=result["collections"])


@router.post("/import/preview/share-code", response_model=ImportPreviewResponse)
def import_preview_share_code(
    request: ImportShareCodeRequest,
    _current_user: CurrentUser = Depends(require_admin),
) -> ImportPreviewResponse:
    try:
        import_data = parse_import_data(share_code=request.share_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid share code: {str(e)}")

    config = load_config()
    server = get_plex_server(config)

    try:
        result = preview_import(server, import_data, request.target_library)
    except Exception as e:
        logger.error("Import preview failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")

    return ImportPreviewResponse(collections=result["collections"])


@router.post("/import/apply", response_model=ImportApplyResponse)
async def import_apply_file(
    target_library: str,
    import_name: Optional[str] = None,
    selected_collections: Optional[List[str]] = Query(None),
    file: UploadFile = File(...),
    _current_user: CurrentUser = Depends(require_admin),
) -> ImportApplyResponse:
    content = await file.read()
    if len(content) > MAX_IMPORT_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    try:
        import_data = parse_import_data(file_content=content.decode("utf-8"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid import file: {str(e)}")

    config = load_config()
    server = get_plex_server(config)

    try:
        result = apply_import(
            server, import_data, target_library,
            import_name=import_name,
            selected_collections=selected_collections,
        )
    except Exception as e:
        logger.error("Import apply failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    return ImportApplyResponse(
        collections=result["collections"],
        import_name=result["import_name"],
    )


@router.post("/import/apply/share-code", response_model=ImportApplyResponse)
def import_apply_share_code(
    request: ImportApplyShareCodeRequest,
    _current_user: CurrentUser = Depends(require_admin),
) -> ImportApplyResponse:
    try:
        import_data = parse_import_data(share_code=request.share_code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid share code: {str(e)}")

    config = load_config()
    server = get_plex_server(config)

    try:
        result = apply_import(
            server, import_data, request.target_library,
            import_name=request.import_name,
            selected_collections=request.selected_collections,
        )
    except Exception as e:
        logger.error("Import apply failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

    return ImportApplyResponse(
        collections=result["collections"],
        import_name=result["import_name"],
    )


# ------------------------------------------------------------------
# Missing items endpoints
# ------------------------------------------------------------------

@router.get("/import/missing", response_model=MissingItemsResponse)
def get_missing_items(
    import_name: Optional[str] = None,
    _current_user: CurrentUser = Depends(require_admin),
) -> MissingItemsResponse:
    items = get_import_missing_items(import_name)
    return MissingItemsResponse(items=items, count=len(items))


@router.delete("/import/missing", response_model=ClearMissingResponse)
def clear_missing_items(
    import_name: str,
    _current_user: CurrentUser = Depends(require_admin),
) -> ClearMissingResponse:
    deleted = clear_import_missing_items(import_name)
    return ClearMissingResponse(deleted=deleted)
