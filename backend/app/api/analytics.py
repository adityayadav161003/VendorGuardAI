"""
Executive analytics: aggregate KPIs computed from real stored data.
GET /api/analytics/overview
"""

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.entities import (
    AnalysisResult, Claim, Document, ExtractedEntity, Supplier, User,
)

router = APIRouter()

VECTOR_KEYS = ["identity", "documents", "financial", "operational", "network", "reputation"]


@router.get("/overview")
def analytics_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    suppliers: List[Supplier] = db.query(Supplier).all()

    latest_analyses: Dict[str, AnalysisResult] = {}
    for s in suppliers:
        row = (
            db.query(AnalysisResult)
            .filter(AnalysisResult.supplier_id == s.supplier_id)
            .order_by(AnalysisResult.generated_at.desc())
            .first()
        )
        if row:
            latest_analyses[s.supplier_id] = row

    scored = list(latest_analyses.values())

    distribution = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    vector_sums = {k: 0.0 for k in VECTOR_KEYS}
    vector_counts = {k: 0 for k in VECTOR_KEYS}
    for a in scored:
        level = (a.risk_level or "MEDIUM").upper()
        if level in distribution:
            distribution[level] += 1
        breakdown = a.risk_breakdown or {}
        for k in VECTOR_KEYS:
            val = breakdown.get(k)
            if isinstance(val, dict):
                val = val.get("score")
            if val is not None:
                try:
                    vector_sums[k] += float(val)
                    vector_counts[k] += 1
                except (ValueError, TypeError):
                    pass

    valid_scores = [a.risk_score for a in scored if a.risk_score is not None]
    avg_risk = round(sum(valid_scores) / len(valid_scores), 1) if valid_scores else None

    # Expiry watchlist: soonest expiry entities per supplier, verified against today
    from datetime import date
    expiry_watchlist = []
    today = date.today()
    for s in suppliers:
        rows = (
            db.query(ExtractedEntity)
            .join(Document, ExtractedEntity.document_id == Document.document_id)
            .filter(Document.supplier_id == s.supplier_id)
            .filter(ExtractedEntity.entity_type == "EXPIRY_DATE")
            .all()
        )
        for ent in rows:
            value = str(ent.entity_value).strip()
            parsed = None
            for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d-%b-%Y"]:
                try:
                    from datetime import datetime as dt
                    parsed = dt.strptime(value, fmt).date()
                    break
                except ValueError:
                    continue
            if parsed:
                expiry_watchlist.append({
                    "supplier_id": s.supplier_id,
                    "supplier_name": s.name,
                    "expiry_date": parsed.isoformat(),
                    "days_remaining": (parsed - today).days,
                    "source_document": next(
                        (d.file_name for d in db.query(Document)
                         .filter(Document.document_id == ent.document_id)),
                        "uploaded document",
                    ),
                })
    expiry_watchlist.sort(key=lambda x: x["days_remaining"])
    expiry_watchlist = expiry_watchlist[:6]

    # Most frequent caution-level finding categories across stored analyses
    category_counts: Dict[str, int] = {}
    for a in scored:
        for f in (a.key_findings or []):
            if f.get("severity") in ("warning", "danger"):
                cat = f.get("category", "General")
                category_counts[cat] = category_counts.get(cat, 0) + 1
    top_risk_categories = sorted(
        [{"category": k, "count": v} for k, v in category_counts.items()],
        key=lambda x: x["count"], reverse=True,
    )[:5]

    # Claim verification health
    total_claims = db.query(Claim).count()
    supported = db.query(Claim).filter(Claim.status == "SUPPORTED").count()

    # Recent analyses trend (oldest → newest)
    recent_rows = (
        db.query(AnalysisResult)
        .order_by(AnalysisResult.generated_at.desc())
        .limit(10)
        .all()
    )
    recent_analyses = [
        {
            "supplier_id": a.supplier_id,
            "risk_score": a.risk_score,
            "risk_level": a.risk_level,
            "generated_at": a.generated_at,
        }
        for a in reversed(recent_rows)
    ]

    return {
        "totals": {
            "suppliers": len(suppliers),
            "verified": sum(1 for s in suppliers if s.status == "VERIFIED"),
            "flagged": sum(1 for s in suppliers if s.status in ("FLAGGED", "REJECTED")),
            "pending_review": sum(1 for s in suppliers if s.status == "REVIEW_PENDING"),
            "documents": db.query(Document).count(),
            "analyses_run": db.query(AnalysisResult).count(),
        },
        "avg_risk": avg_risk,
        "risk_distribution": distribution,
        "vector_averages": {
            k: round(vector_sums[k] / vector_counts[k], 1) if vector_counts[k] else None
            for k in VECTOR_KEYS
        },
        "expiry_watchlist": expiry_watchlist,
        "top_risk_categories": top_risk_categories,
        "claim_health": {
            "total": total_claims,
            "supported": supported,
            "support_rate": round(supported / total_claims * 100, 1) if total_claims else None,
        },
        "recent_analyses": recent_analyses,
        "generated_at": datetime.now(timezone.utc),
    }
