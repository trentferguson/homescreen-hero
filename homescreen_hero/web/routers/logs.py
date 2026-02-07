from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from homescreen_hero.core.auth import get_current_user
from homescreen_hero.core.logging_config import LOG_FILE

router = APIRouter(prefix="/logs", tags=["logs"])


# Return last "n" lines of the application log file
@router.get("/tail", response_class=PlainTextResponse)
def tail_logs(
    lines: int = 200,
    _current_user: str = Depends(get_current_user),
) -> PlainTextResponse:
    try:
        path = LOG_FILE
        if not path.exists():
            raise HTTPException(status_code=404, detail="Log file not found.")

        with open(LOG_FILE, "r", encoding="utf-8") as file_handle:
            all_lines = file_handle.readlines()
            tail_lines = all_lines[-lines:]
            return PlainTextResponse("".join(tail_lines))

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/download")
def download_logs(_current_user: str = Depends(get_current_user)):
    if not LOG_FILE.exists():
        raise HTTPException(status_code=404, detail="Log file not found.")

    return FileResponse(
        path=LOG_FILE,
        filename="homescreen_hero.log",
        media_type="text/plain",
    )
