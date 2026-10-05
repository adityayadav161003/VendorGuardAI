"""
Claim Verification & Human Review API.

- POST /api/claims/verify        : verify an arbitrary claim against a supplier's
                                   full evidence pool (uploaded docs + permitted sources)
- GET  /api/claims/{claim_id}    : fetch a persisted claim with its review history
- POST /api/claims/{claim_id}/review : record a reviewer decision (AC4 human-in-the-loop)
"""

from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Claim, ReviewerAction
from app.schemas.analysis import ClaimVerifyRequest, ClaimVerification, ClaimReviewRequest
from app.services.claim_verifier import claim_verifier_service
from app.services.evidence_store import evidence_store
from app.services.audit import record_event
from app.core.security import get_current_user, require_roles
from app.models.entities import User

router = APIRouter()

ALLOWED_REVIEW_ACTIONS = {"APPROVED", "OVERRIDDEN", "REJECTED"}


@router.post("/verify", response_model=ClaimVerification)
def verify_custom_claim(
    payload: ClaimVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AC4: verify any text claim against a supplier's evidence, or provided context only."""
    evidence_pool = []
    if payload.supplier_id:
        evidence_pool.extend(evidence_store.build_evidence_pool(db, payload.supplier_id)["evidence_pool"])

    if payload.context_text:
        evidence_pool.append({
            "evidence_id": "ev-context",
            "source_type": "USER_CONTEXT",
            "title": "Provided Context",
            "snippet": payload.context_text,
            "reliability_score": 0.9,
            "document_id": None,
            "page": 1,
            "origin": "USER_CONTEXT",
        })

    if not evidence_pool:
        raise HTTPException(
            status_code=400,
            detail="No evidence available: provide a supplier_id with documents, or context_text.",
        )

    res = claim_verifier_service.verify_single_claim(payload.claim_text, evidence_pool)
    return ClaimVerification(
        claim_id="clm-verify-req",
        claim_text=res["claim_text"],
        claim_type="USER_QUERY_CLAIM",
        status=res["status"],
        confidence_score=res["confidence_score"],
        evidence_snippet=res["evidence_snippet"],
        source_doc_name=res["source_doc_name"],
        evidence_id=res.get("evidence_id"),
    )


@router.get("/{claim_id}", response_model=ClaimVerification)
def get_claim(claim_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    latest = (
        db.query(ReviewerAction)
        .filter(ReviewerAction.claim_id == claim_id)
        .order_by(ReviewerAction.reviewed_at.desc())
        .first()
    )
    return ClaimVerification(
        claim_id=claim.claim_id,
        claim_text=claim.claim_text,
        claim_type=claim.claim_type,
        status=claim.status,
        confidence_score=claim.confidence_score,
        evidence_snippet=claim.evidence_snippet,
        source_doc_name=claim.source_doc_name,
        evidence_id=claim.evidence_id,
        reviewer_state=latest.action if latest else "PENDING",
    )


@router.post("/{claim_id}/review", response_model=ClaimVerification)
def review_claim(
    claim_id: str,
    payload: ClaimReviewRequest,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles("reviewer")),
):
    """Records a human reviewer decision, stored separately from model output."""
    if payload.action not in ALLOWED_REVIEW_ACTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid action '{payload.action}'. Allowed: {', '.join(sorted(ALLOWED_REVIEW_ACTIONS))}",
        )

    claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    action = ReviewerAction(
        claim_id=claim.claim_id,
        reviewer_id=reviewer.user_id,
        action=payload.action,
        comment=payload.comment,
    )
    db.add(action)
    record_event(db, f"CLAIM_{payload.action}", claim.claim_id, user_id=reviewer.user_id, details={
        "claim_text": claim.claim_text[:200],
        "model_status": claim.status,
    })
    db.commit()
    db.refresh(action)

    return ClaimVerification(
        claim_id=claim.claim_id,
        claim_text=claim.claim_text,
        claim_type=claim.claim_type,
        status=claim.status,
        confidence_score=claim.confidence_score,
        evidence_snippet=claim.evidence_snippet,
        source_doc_name=claim.source_doc_name,
        evidence_id=claim.evidence_id,
        reviewer_state=action.action,
    )
