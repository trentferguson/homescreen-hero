# scheduler.py
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from homescreen_hero.core.config.loader import load_config
from homescreen_hero.core.config.schema import AppConfig
from homescreen_hero.core.service import run_rotation_once

logger = logging.getLogger(__name__)

JOB_ID = "rotation-job"
_scheduler: Optional[BackgroundScheduler] = None


def get_scheduler() -> Optional[BackgroundScheduler]:
    """Get the current scheduler instance."""
    return _scheduler


def _run_scheduled_rotation() -> None:
    try:
        logger.info("Running scheduled rotation")
        run_rotation_once(dry_run=True)
    except Exception:  # pragma: no cover
        logger.exception("Scheduled rotation failed")


def _compute_next_run_time(interval_hours: int) -> datetime:
    return datetime.now() + timedelta(hours=interval_hours)


def update_rotation_schedule(config: Optional[AppConfig] = None) -> None:
    # Apply rotation scheduling changes without restarting the app.

    # Behavior:
    # - If disabled: stop scheduler.
    # - If enabled and scheduler not running: start scheduler (first run = now + interval).
    # - If enabled and running:
    #     * reschedule interval trigger
    #     * if interval_hours changed, adjust next_run_time to now + new interval

    global _scheduler

    if config is None:
        config = load_config()

    if not config.rotation.enabled:
        stop_rotation_scheduler()
        logger.info("Rotation scheduler disabled via config")
        return

    if _scheduler is None or not _scheduler.running:
        start_rotation_scheduler(config=config)
        return

    job = _scheduler.get_job(JOB_ID)
    if job is None:
        # Defensive: recreate job
        _scheduler.add_job(
            _run_scheduled_rotation,
            trigger=IntervalTrigger(hours=config.rotation.interval_hours),
            id=JOB_ID,
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            next_run_time=_compute_next_run_time(config.rotation.interval_hours),
        )
        logger.info(
            "Rotation job recreated with %s hour interval",
            config.rotation.interval_hours,
        )
        return

    # Determine previous interval hours from the existing trigger
    old_interval_hours: Optional[int] = None
    try:
        trigger = job.trigger
        old_interval_hours = int(trigger.interval.total_seconds() // 3600) 
    except Exception:
        old_interval_hours = None

    new_interval_hours = int(config.rotation.interval_hours)

    _scheduler.reschedule_job(JOB_ID, trigger=IntervalTrigger(hours=new_interval_hours))

    # Only reset "next run" when interval actually change
    if old_interval_hours is None or old_interval_hours != new_interval_hours:
        next_run = _compute_next_run_time(new_interval_hours)
        _scheduler.modify_job(JOB_ID, next_run_time=next_run)

        logger.info(
            "Rotation schedule updated: %s -> %s hour(s); next run at %s",
            old_interval_hours,
            new_interval_hours,
            next_run,
        )
    else:
        logger.info(
            "Rotation schedule saved; interval unchanged (%s hour[s]); leaving next run as-is",
            new_interval_hours,
        )


def start_rotation_scheduler(
    config: Optional[AppConfig] = None,
) -> Optional[BackgroundScheduler]:
    global _scheduler

    if _scheduler and _scheduler.running:
        logger.info("Rotation scheduler already running; reusing existing scheduler")
        return _scheduler

    if config is None:
        config = load_config()

    if not config.rotation.enabled:
        logger.info("Rotation scheduler not started because rotation.enabled is False")
        return None

    interval_hours = int(config.rotation.interval_hours)

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _run_scheduled_rotation,
        trigger=IntervalTrigger(hours=interval_hours),
        id=JOB_ID,
        replace_existing=True,
        coalesce=True,
        max_instances=1,
        # First run happens after the interval (does not run immediately on start)
        next_run_time=_compute_next_run_time(interval_hours),
    )
    scheduler.start()

    logger.info("Rotation scheduler started: every %s hour(s)", interval_hours)
    _scheduler = scheduler
    return scheduler


def stop_rotation_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    logger.info("Stopping rotation scheduler")
    _scheduler.shutdown(wait=False)
    _scheduler = None
