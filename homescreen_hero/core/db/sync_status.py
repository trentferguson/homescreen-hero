from __future__ import annotations

from datetime import datetime
from typing import Optional

from .base import session_scope
from .models import SourceSyncRecord


def record_sync_result(
    integration_type: str,
    source_name: str,
    source_url: str,
    items_total: int,
    items_matched: int,
    sync_status: str = "success",
    error_message: Optional[str] = None,
) -> None:
    # Upsert the sync result for a source (one record per integration+name)
    with session_scope() as session:
        record = session.query(SourceSyncRecord).filter(
            SourceSyncRecord.integration_type == integration_type,
            SourceSyncRecord.source_name == source_name,
        ).first()

        now = datetime.utcnow()

        if record:
            record.source_url = source_url
            record.sync_status = sync_status
            record.last_sync_time = now
            record.items_total = items_total
            record.items_matched = items_matched
            record.error_message = error_message
        else:
            record = SourceSyncRecord(
                integration_type=integration_type,
                source_name=source_name,
                source_url=source_url,
                sync_status=sync_status,
                last_sync_time=now,
                items_total=items_total,
                items_matched=items_matched,
                error_message=error_message,
            )
            session.add(record)


def get_sync_status(
    integration_type: str,
    source_name: str,
) -> Optional[SourceSyncRecord]:
    # Get the latest sync record for a source, or None if never synced
    with session_scope() as session:
        return session.query(SourceSyncRecord).filter(
            SourceSyncRecord.integration_type == integration_type,
            SourceSyncRecord.source_name == source_name,
        ).first()
