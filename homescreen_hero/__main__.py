import logging
import sys

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.logging_config import setup_logging, level_from_name
from homescreen_hero.core.service import run_rotation_once

logger = logging.getLogger(__name__)

def main() -> None:
    # Set up basic console-only logging for config loading
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    try:
        config = load_config()
    except FileNotFoundError as e:
        logging.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"Failed to load configuration: {e}", exc_info=True)
        sys.exit(1)
    
    # Only set up full logging (with file) after config loads successfully
    log_level = level_from_name(config.logging.level)
    setup_logging(level=log_level, reconfigure=True)

    execution = run_rotation_once(dry_run=False)
    rotation = execution.rotation

    logger.info(f"Rotation date: {rotation.today}")
    logger.info(f"Selected collections: {rotation.selected_collections}")
    logger.info(f"Applied (or would apply): {execution.applied_collections}")
    logger.info(f"dry_run: {execution.dry_run}")


if __name__ == "__main__":
    main()
