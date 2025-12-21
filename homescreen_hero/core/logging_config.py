import os
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Environment variable for log directory override
LOG_DIR_ENV_VAR = "HOMESCREEN_HERO_LOG_DIR"

# Default for local dev
DEFAULT_LOG_DIR = Path("logs")


def get_log_dir() -> Path:
    raw = os.environ.get(LOG_DIR_ENV_VAR)
    if raw:
        return Path(raw)
    return DEFAULT_LOG_DIR


LOG_DIR = get_log_dir()
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = LOG_DIR / "homescreen_hero.log"


def level_from_name(name: str) -> int:
    return getattr(logging, name.upper(), logging.INFO)


def _configure_handlers(root: logging.Logger, level: int) -> None:
    existing_handler_types = {type(handler) for handler in root.handlers}

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if RotatingFileHandler not in existing_handler_types:
        file_handler = RotatingFileHandler(
            LOG_FILE, maxBytes=5_000_000, backupCount=3, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(level)
        root.addHandler(file_handler)

    if logging.StreamHandler not in existing_handler_types:
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        console_handler.setLevel(level)
        root.addHandler(console_handler)


def setup_logging(level: int | str = logging.INFO, reconfigure: bool = False) -> None:
    if isinstance(level, str):
        level = level_from_name(level)

    root = logging.getLogger()
    root.setLevel(level)

    if reconfigure:
        root.handlers.clear()

    _configure_handlers(root, level)

    for handler in root.handlers:
        handler.setLevel(level)

    logging.captureWarnings(True)
    root.debug(
        "Logging configured (level=%s, handlers=%d, log_file=%s)",
        logging.getLevelName(level),
        len(root.handlers),
        LOG_FILE,
    )
