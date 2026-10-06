from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class RiskVectorDetail(BaseModel):
    score: Optional[float] = None
    status: str = Field(default="insufficient", description="computed | insufficient | na")
    evidence_ids: List[str] = Field(default_factory=list)
    reason_codes: List[str] = Field(default_factory=list)
    rule_version: str = "v2.0.0-trust-core"

class RiskBreakdown(BaseModel):
    identity: Optional[float] = None
    documents: Optional[float] = None
    financial: Optional[float] = None
    operational: Optional[float] = None
    network: Optional[float] = None
    reputation: Optional[float] = None
    vectors: Dict[str, RiskVectorDetail] = Field(default_factory=dict)

class KeyFinding(BaseModel):
    id: str
    severity: str = Field(..., description="success, info, warning, danger")
    message: str
    category: str  # Identity, Compliance, Financial, Network, Reputation
    source_reference: Optional[str] = None
    page_number: Optional[int] = None
    conflict_type: Optional[str] = None
    source_a: Optional[str] = None
    source_b: Optional[str] = None
    source_a_details: Optional[Dict[str, Any]] = None
    source_b_details: Optional[Dict[str, Any]] = None
    similarity_score: Optional[float] = None
    status: Optional[str] = "OPEN"

class ClaimVerification(BaseModel):
    claim_id: str
    claim_text: str
    claim_type: str
    status: str = Field(..., description="SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE")
    confidence_score: float
    evidence_snippet: Optional[str] = None
    source_doc_name: Optional[str] = None
    evidence_id: Optional[str] = None
    reviewer_state: str = Field(default="PENDING", description="PENDING, APPROVED, OVERRIDDEN, REJECTED, NEEDS_MORE_EVIDENCE")

class AnalysisReportResponse(BaseModel):
    analysis_id: str
    supplier_id: str
    supplier_name: str
    assessment_state: str = Field(default="ASSESSED", description="NOT_ASSESSABLE, PROVISIONAL, ASSESSED")
    evidence_coverage: float = Field(default=0.0, description="0 to 100 coverage score")
    assessment_confidence: float = Field(default=0.0, description="0 to 100 confidence score")
    provisional_reason: Optional[str] = None
    risk_score: Optional[float] = None  # null when state is NOT_ASSESSABLE
    risk_level: str = "UNASSESSED"  # UNASSESSED, LOW, MEDIUM, HIGH
    summary: str
    risk_breakdown: RiskBreakdown
    key_findings: List[KeyFinding]
    claims: List[ClaimVerification]
    system_notices: List[str] = Field(default_factory=list)
    is_evidence_grounded: bool = False
    model_version: str = "v2.0.0-trust-core"
    rule_version: str = "v2.0.0-trust-core"
    generated_at: datetime
    data_source: str = Field(default="NO_EVIDENCE", description="UPLOADED_DOCUMENTS, DEMO_FIXTURES or NO_EVIDENCE")
    document_count: int = 0

class ClaimReviewRequest(BaseModel):
    action: str = Field(..., description="APPROVED, OVERRIDDEN, REJECTED, NEEDS_MORE_EVIDENCE")
    comment: Optional[str] = Field(default=None, max_length=2000)

class AlertResponse(BaseModel):
    severity: str
    category: str
    message: str
    source_reference: Optional[str] = None
    generated_at: datetime

class ClaimVerifyRequest(BaseModel):
    claim_text: str = Field(..., min_length=5, max_length=5000)
    supplier_id: Optional[str] = None
    context_text: Optional[str] = Field(default=None, max_length=20000)

class ChatRequest(BaseModel):
    supplier_id: str
    question: str = Field(..., min_length=3, max_length=1000)

class Citation(BaseModel):
    doc_id: str
    doc_name: str
    page: int
    snippet: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    verification_status: str
    claims_verified: int
    claims_unsupported: int

class CompareSuppliersRequest(BaseModel):
    supplier_ids: List[str] = Field(..., min_length=2, max_length=10)
