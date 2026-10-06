"""
Continuous Monitoring, Expiry Alerts & Supplier Timeline API.
Tracks certificate expirations (30/15/7 day tiers), audits change histories, and handles scheduled re-checks.
"""

from datetime import datetime, date, timezone
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    Supplier, Document, ExtractedEntity, SupplierTimeline, User, AnalysisResult
)
from app.services.audit import record_event
from app.api.analysis import run_analysis

router = APIRouter()


@router.get("/alerts")
def get_monitoring_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Returns certificate expiry alerts across all suppliers in 30, 15, 7 day tiers or expired.
    Every alert is grounded in an actual extracted EXPIRY_DATE entity.
    """
    today = date.today()
    suppliers = db.query(Supplier).all()

    alerts: List[Dict[str, Any]] = []

    for s in suppliers:
        rows = (
            db.query(ExtractedEntity)
            .join(Document, ExtractedEntity.document_id == Document.document_id)
            .filter(Document.supplier_id == s.supplier_id)
            .filter(ExtractedEntity.entity_type == "EXPIRY_DATE")
            .all()
        )

        for ent in rows:
            val = str(ent.entity_value).strip()
            parsed_date = None
            for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d-%b-%Y"]:
                try:
                    parsed_date = datetime.strptime(val, fmt).date()
                    break
                except ValueError:
                    continue

            if not parsed_date:
                continue

            delta_days = (parsed_date - today).days

            # Only alert on items within 30 days or already expired
            if delta_days <= 30:
                doc = db.query(Document).filter(Document.document_id == ent.document_id).first()
                doc_name = doc.file_name if doc else "Compliance Certificate"

                if delta_days <= 0:
                    tier = "EXPIRED"
                    severity = "danger"
                    msg = f"Statutory certificate expired {abs(delta_days)} day(s) ago ({parsed_date.isoformat()}). Action required."
                elif delta_days <= 7:
                    tier = "7_DAYS"
                    severity = "danger"
                    msg = f"Urgent: Certificate expires in {delta_days} day(s) on {parsed_date.isoformat()}."
                elif delta_days <= 15:
                    tier = "15_DAYS"
                    severity = "warning"
                    msg = f"Warning: Certificate renewal required in {delta_days} days on {parsed_date.isoformat()}."
                else:
                    tier = "30_DAYS"
                    severity = "info"
                    msg = f"Notice: Certificate expires in {delta_days} days on {parsed_date.isoformat()}."

                alerts.append({
                    "supplier_id": s.supplier_id,
                    "supplier_name": s.name,
                    "document_id": ent.document_id,
                    "source_document": doc_name,
                    "tier": tier,
                    "severity": severity,
                    "expiry_date": parsed_date.isoformat(),
                    "days_remaining": delta_days,
                    "message": msg,
                    "status": "ACTIVE_MONITORED",  # Only labeled active because actually implemented
                })

    alerts.sort(key=lambda a: a["days_remaining"])

    return {
        "total_alerts": len(alerts),
        "critical_count": sum(1 for a in alerts if a["severity"] == "danger"),
        "warning_count": sum(1 for a in alerts if a["severity"] == "warning"),
        "info_count": sum(1 for a in alerts if a["severity"] == "info"),
        "alerts": alerts,
        "as_of": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/suppliers/{supplier_id}/timeline")
def get_supplier_timeline(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Returns the immutable change timeline for a supplier."""
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    events = (
        db.query(SupplierTimeline)
        .filter(SupplierTimeline.supplier_id == supplier.supplier_id)
        .order_by(SupplierTimeline.created_at.desc())
        .all()
    )

    # If timeline is empty, seed initial supplier creation event
    timeline_items = []
    for e in events:
        timeline_items.append({
            "timeline_id": e.timeline_id,
            "event_type": e.event_type,
            "title": e.title,
            "description": e.description,
            "metadata": e.metadata_json or {},
            "created_at": e.created_at.isoformat() if e.created_at else "",
        })

    if not timeline_items:
        timeline_items.append({
            "timeline_id": "seed-001",
            "event_type": "SUPPLIER_CREATED",
            "title": f"Supplier profile registered",
            "description": f"{supplier.name} added to VendorGuard catalogue.",
            "metadata": {},
            "created_at": supplier.created_at.isoformat() if supplier.created_at else "",
        })

    return {
        "supplier_id": supplier.supplier_id,
        "supplier_name": supplier.name,
        "total_events": len(timeline_items),
        "timeline": timeline_items,
    }


@router.post("/recheck/{supplier_id}")
def recheck_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Executes a scheduled or manual re-assessment of a supplier to monitor status changes."""
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    old_analysis = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.supplier_id == supplier.supplier_id)
        .order_by(AnalysisResult.generated_at.desc())
        .first()
    )
    old_score = old_analysis.risk_score if old_analysis else None
    old_state = getattr(old_analysis, "assessment_state", "UNASSESSED") if old_analysis else "UNASSESSED"

    # Re-run assessment
    new_report = run_analysis(db, supplier)

    score_diff = None
    if old_score is not None and new_report.risk_score is not None:
        score_diff = round(new_report.risk_score - old_score, 1)

    timeline_desc = (
        f"Scheduled re-check complete. Trust score: {new_report.risk_score or 'N/A'}"
        + (f" (delta: {score_diff:+})" if score_diff is not None else "")
    )
    timeline = SupplierTimeline(
        supplier_id=supplier.supplier_id,
        event_type="RECHECK_COMPLETED",
        title="Supplier Re-assessment Executed",
        description=timeline_desc,
        metadata_json={
            "old_score": old_score,
            "new_score": new_report.risk_score,
            "old_state": old_state,
            "new_state": new_report.assessment_state,
        },
    )
    db.add(timeline)
    db.commit()

    record_event(
        db,
        action="SUPPLIER_RECHECKED",
        object_id=supplier.supplier_id,
        user_id=current_user.user_id,
        details={"score_diff": score_diff, "new_score": new_report.risk_score}
    )

    return {
        "supplier_id": supplier.supplier_id,
        "old_score": old_score,
        "new_score": new_report.risk_score,
        "score_diff": score_diff,
        "assessment_state": new_report.assessment_state,
        "rechecked_at": datetime.now(timezone.utc).isoformat(),
    }
