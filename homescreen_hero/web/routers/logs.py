from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from homescreen_hero.core.logging_config import LOG_FILE

router = APIRouter(prefix="/logs", tags=["logs"])


# Return last "n" lines of the application log file
@router.get("/tail", response_class=PlainTextResponse)
def tail_logs(lines: int = 200) -> PlainTextResponse:
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
