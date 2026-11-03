from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.analysis import ClaimVerifyRequest, ClaimVerification
from app.services.claim_verifier import claim_verifier_service
from data.fixtures.demo_data import DEMO_SUPPLIERS

router = APIRouter()

@router.post("/verify", response_model=ClaimVerification)
def verify_custom_claim(payload: ClaimVerifyRequest, db: Session = Depends(get_db)):
    """
    AC4: Direct endpoint to verify any arbitrary text claim against uploaded supplier evidence.
    """
    evidence_pool = []
    if payload.supplier_id:
        demo = next((d for d in DEMO_SUPPLIERS if d["supplier_id"] == payload.supplier_id), None)
        if demo:
            evidence_pool.extend(demo.get("evidence_sources", []))

    if payload.context_text:
        evidence_pool.append({
            "evidence_id": "ev-custom",
            "title": "Provided Context",
            "snippet": payload.context_text
        })

    if not evidence_pool:
        # Default mock pool
        evidence_pool.append({
            "evidence_id": "ev-default",
            "title": "Repository Document",
            "snippet": "General company document repository."
        })

    res = claim_verifier_service.verify_single_claim(payload.claim_text, evidence_pool)
    return ClaimVerification(
        claim_id="clm-verify-req",
        claim_text=res["claim_text"],
        claim_type="USER_QUERY_CLAIM",
        status=res["status"],
        confidence_score=res["confidence_score"],
        evidence_snippet=res["evidence_snippet"],
        source_doc_name=res["source_doc_name"]
    )

# Claims verify router
