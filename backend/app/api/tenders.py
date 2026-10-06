"""
Tender / Award API.

POST /api/tenders/evaluate  — rank supplier bids for an RFQ and persist the decision
GET  /api/tenders           — evaluation history (audit trail)
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.entities import TenderEvaluation, User
from app.services.audit import record_event
from app.services.tender_engine import tender_award_engine

router = APIRouter()

MAX_BIDS = 10


class TenderBid(BaseModel):
    supplier_id: str
    unit_price: float = Field(..., ge=0)
    lead_time_days: Optional[int] = Field(default=None, ge=0, le=365)


class TenderEvaluateRequest(BaseModel):
    quantity: int = Field(..., ge=1, le=1_000_000)
    target_unit_price: Optional[float] = Field(default=None, ge=0)
    deadline_days: Optional[int] = Field(default=None, ge=1, le=365)
    bids: List[TenderBid] = Field(..., min_length=2, max_length=MAX_BIDS)


@router.post("/evaluate")
def evaluate_tender(
    payload: TenderEvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rank an RFQ's bids using live risk scores + price + delivery feasibility."""
    from app.api.analysis import _resolve_supplier, _stored_report, run_analysis
    from app.models.entities import Supplier

    seen = set()
    enriched_bids = []
    for bid in payload.bids:
        if bid.supplier_id in seen:
            raise HTTPException(status_code=422, detail="Duplicate supplier in bids.")
        seen.add(bid.supplier_id)

        supplier = _resolve_supplier(db, bid.supplier_id)
        report = _stored_report(db, supplier) or run_analysis(db, supplier)

        enriched_bids.append({
            "supplier_id": bid.supplier_id,
            "supplier_name": supplier.name,
            "unit_price": bid.unit_price,
            "lead_time_days": bid.lead_time_days,
            "risk_score": report.risk_score,
            "risk_level": report.risk_level,
        })

    result = tender_award_engine.evaluate(
        bids=enriched_bids,
        quantity=payload.quantity,
        target_unit_price=payload.target_unit_price,
        deadline_days=payload.deadline_days,
    )

    record = TenderEvaluation(
        quantity=payload.quantity,
        target_unit_price=payload.target_unit_price,
        deadline_days=payload.deadline_days,
        created_by=current_user.user_id,
        result_json=result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    record_event(db, "TENDER_EVALUATED", record.tender_id, user_id=current_user.user_id, details={
        "bids": len(enriched_bids),
        "winner": result["recommendation"]["winner_supplier_name"],
    })
    db.commit()

    return {"tender_id": record.tender_id, **result}


@router.get("")
def list_tenders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    evaluations = (
        db.query(TenderEvaluation)
        .order_by(TenderEvaluation.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "tender_id": t.tender_id,
            "quantity": t.quantity,
            "deadline_days": t.deadline_days,
            "created_at": t.created_at,
            "winner": (t.result_json or {}).get("recommendation", {}).get("winner_supplier_name"),
            "winner_score": next(
                (
                    b["composite_score"]
                    for b in (t.result_json or {}).get("ranked_bids", [])
                    if b["supplier_id"] == (t.result_json or {}).get("recommendation", {}).get("winner_supplier_id")
                ),
                None,
            ),
            "bid_count": len((t.result_json or {}).get("ranked_bids", [])),
        }
        for t in evaluations
    ]
