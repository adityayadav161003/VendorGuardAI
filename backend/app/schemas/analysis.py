from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class RiskBreakdown(BaseModel):
    identity: float = Field(default=85.0, description="Identity & tax authenticity (0-100)")
    documents: float = Field(default=80.0, description="Completeness & document validity (0-100)")
    financial: float = Field(default=75.0, description="Financial consistency & bank verification (0-100)")
    operational: float = Field(default=80.0, description="Operational stability & vintage (0-100)")
    network: float = Field(default=70.0, description="Network & fraud ring risk (0-100)")
    reputation: float = Field(default=75.0, description="Reputation & public sentiment (0-100)")

class KeyFinding(BaseModel):
    id: str
    severity: str = Field(..., description="success, info, warning, danger")
    message: str
    category: str  # Identity, Compliance, Financial, Network, Reputation
    source_reference: Optional[str] = None
    page_number: Optional[int] = None

class ClaimVerification(BaseModel):
    claim_id: str
    claim_text: str
    claim_type: str
    status: str = Field(..., description="SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE")
    confidence_score: float
    evidence_snippet: Optional[str] = None
    source_doc_name: Optional[str] = None

class AnalysisReportResponse(BaseModel):
    analysis_id: str
    supplier_id: str
    supplier_name: str
    risk_score: float
    risk_level: str  # LOW, MEDIUM, HIGH
    summary: str
    risk_breakdown: RiskBreakdown
    key_findings: List[KeyFinding]
    claims: List[ClaimVerification]
    model_version: str
    generated_at: datetime

class ClaimVerifyRequest(BaseModel):
    claim_text: str
    supplier_id: Optional[str] = None
    context_text: Optional[str] = None

class ChatRequest(BaseModel):
    supplier_id: str
    question: str

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
    supplier_ids: List[str]

# Risk evaluation schemas

# Verification models
# Comparison DTO
