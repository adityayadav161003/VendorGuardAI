"""
AI Analyst Chat — retrieval-grounded, citation-first.

Every answer is composed from the top retrieved evidence passages for the
supplier (uploaded documents first, permitted fixture evidence second) and is
then run through the claim verifier so the response states exactly which
parts of the answer are supported and which are not. When retrieval cannot
find relevant evidence the analyst says so instead of inventing content.
"""

from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Supplier
from app.schemas.analysis import ChatRequest, ChatResponse, Citation
from app.services.evidence_store import evidence_store
from app.services.claim_verifier import claim_verifier_service
from app.core.security import get_current_user
from app.models.entities import User

router = APIRouter()

RETRIEVAL_FLOOR = 0.12  # below this, the honest answer is "insufficient evidence"


@router.post("", response_model=ChatResponse)
def chat_with_supplier_data(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier = db.query(Supplier).filter(Supplier.supplier_id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    pool = evidence_store.build_evidence_pool(db, payload.supplier_id)
    evidence_pool = pool["evidence_pool"]

    if not evidence_pool:
        return ChatResponse(
            answer=(
                f"I have no documents or evidence on file for {supplier.name} yet. "
                "Upload supplier documents and I will answer with citations from them."
            ),
            citations=[],
            verification_status="INSUFFICIENT_EVIDENCE",
            claims_verified=0,
            claims_unsupported=1,
        )

    retrieved = evidence_store.retrieve_evidence(payload.question, evidence_pool, k=3)
    retrieved = [(score, ev) for score, ev in retrieved if score >= RETRIEVAL_FLOOR]

    if not retrieved:
        return ChatResponse(
            answer=(
                f"I could not find evidence in {supplier.name}'s repository that answers "
                "\"{}\". ".format(payload.question.strip())
                + "Please rephrase, or upload a document covering this topic — I will not "
                "speculate beyond the evidence on file."
            ),
            citations=[],
            verification_status="INSUFFICIENT_EVIDENCE",
            claims_verified=0,
            claims_unsupported=1,
        )

    # Compose the answer extractively from the retrieved evidence — never from memory
    citations: List[Citation] = []
    answer_parts: List[str] = []
    for score, ev in retrieved:
        snippet = " ".join(ev["snippet"].split())
        if len(snippet) > 260:
            snippet = snippet[:257] + "..."
        answer_parts.append(f"[{ev['title']}] {snippet}")
        citations.append(Citation(
            doc_id=ev.get("document_id") or ev["evidence_id"],
            doc_name=ev["title"],
            page=int(ev.get("page") or 1),
            snippet=ev["snippet"][:300],
        ))

    answer = (
        f"Based on {len(retrieved)} evidence item(s) retrieved for {supplier.name}: "
        + " ".join(answer_parts)
    )

    # Verify what we just said, so the UI can badge the answer honestly
    claims = claim_verifier_service.deconstruct_into_claims(answer)
    verified = 0
    unsupported = 0
    for claim in claims:
        result = claim_verifier_service.verify_single_claim(claim, evidence_pool)
        if result["status"] == "SUPPORTED":
            verified += 1
        else:
            unsupported += 1

    if unsupported == 0:
        status = "GROUNDED_AND_VERIFIED"
    elif verified > 0:
        status = "PARTIALLY_VERIFIED"
    else:
        status = "UNVERIFIED"

    return ChatResponse(
        answer=answer,
        citations=citations,
        verification_status=status,
        claims_verified=verified,
        claims_unsupported=unsupported,
    )
