"""Audit trail helper: records who did what, when (traceability NFR §14.3)."""

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.entities import AuditEvent


def record_event(
    db: Session,
    action: str,
    object_id: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    db.add(AuditEvent(
        user_id=user_id,
        action=action,
        object_id=str(object_id),
        details=details or {},
    ))
