import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    user_id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    role = Column(String(50), default="procurement_officer")  # reviewer, admin, procurement_officer
    organization = Column(String(200), default="GLA Enterprise")
    password_hash = Column(String(255), nullable=True)  # PBKDF2-SHA256; never store plaintext
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    audit_events = relationship("AuditEvent", back_populates="user")

class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False, index=True)
    business_type = Column(String(100), default="Private Limited")
    industry = Column(String(100), default="Manufacturing")
    website = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    status = Column(String(50), default="PENDING_REVIEW")  # PENDING_REVIEW, VERIFIED, FLAGGED, REJECTED
    organization = Column(String(200), default="GLA Enterprise", index=True)
    created_by = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    documents = relationship("Document", back_populates="supplier", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="supplier", cascade="all, delete-orphan")
    risk_reports = relationship("RiskReport", back_populates="supplier", cascade="all, delete-orphan")
    pipeline_jobs = relationship("PipelineJob", back_populates="supplier", cascade="all, delete-orphan")
    invites = relationship("SupplierInvite", back_populates="supplier", cascade="all, delete-orphan")
    timeline_events = relationship("SupplierTimeline", back_populates="supplier", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    document_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    document_type = Column(String(50), nullable=False)  # GST, PAN, INCORPORATION, BANK_STATEMENT, ISO_CERT, INVOICE
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=True)  # SHA-256 for tampering & deduplication
    file_size = Column(Integer, default=0)
    extracted_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, default=dict)
    uploaded_by = Column(String(36), nullable=True)
    status = Column(String(50), default="PROCESSED")  # UPLOADED, PROCESSING, PROCESSED, ERROR
    upload_time = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="documents")
    extracted_entities = relationship("ExtractedEntity", back_populates="document", cascade="all, delete-orphan")

class ExtractedEntity(Base):
    __tablename__ = "extracted_entities"

    entity_id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.document_id"), nullable=False)
    entity_type = Column(String(50), nullable=False)  # GSTIN, PAN, CIN, BANK_ACCOUNT, IFSC, DIRECTOR, DATE, AMOUNT
    entity_value = Column(String(255), nullable=False)
    confidence_score = Column(Float, default=1.0)
    page_number = Column(Integer, default=1)
    snippet = Column(Text, nullable=True)  # Provenance snippet (AC2)
    bounding_box = Column(JSON, nullable=True)  # [x, y, w, h] or None
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("Document", back_populates="extracted_entities")

class EvidenceSource(Base):
    __tablename__ = "evidence_sources"

    evidence_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), nullable=True)
    source_type = Column(String(50), nullable=False)  # DOCUMENT, MCA_PORTAL, GST_PORTAL, NEWS, PUBLIC_REGISTRY
    title = Column(String(255), nullable=False)
    url = Column(String(500), nullable=True)
    snippet = Column(Text, nullable=False)
    reliability_score = Column(Float, default=0.95)
    retrieved_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    analysis_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    assessment_state = Column(String(30), default="ASSESSED")  # NOT_ASSESSABLE, PROVISIONAL, ASSESSED
    evidence_coverage = Column(Float, default=0.0)  # 0 to 100
    assessment_confidence = Column(Float, default=0.0)  # 0 to 100 (capped by evidence_coverage)
    provisional_reason = Column(Text, nullable=True)
    risk_score = Column(Float, nullable=True)  # null when NOT_ASSESSABLE
    risk_level = Column(String(20), default="UNASSESSED")  # UNASSESSED, LOW, MEDIUM, HIGH
    summary = Column(Text, nullable=True)
    risk_breakdown = Column(JSON, default=dict)  # Identity, Documents, Financial, Operational, Network, Reputation
    key_findings = Column(JSON, default=list)
    system_notices = Column(JSON, default=list)
    is_evidence_grounded = Column(Integer, default=0)
    rule_version = Column(String(50), default="v2.0.0-trust-core")
    model_version = Column(String(50), default="v2.0.0-trust-core")
    data_source = Column(String(30), default="NO_EVIDENCE")  # UPLOADED_DOCUMENTS / DEMO_FIXTURES / NO_EVIDENCE
    document_count = Column(Integer, default=0)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="analysis_results")
    claims = relationship("Claim", back_populates="analysis", cascade="all, delete-orphan")

class Claim(Base):
    __tablename__ = "claims"

    claim_id = Column(String(36), primary_key=True, default=generate_uuid)
    analysis_id = Column(String(36), ForeignKey("analysis_results.analysis_id"), nullable=False)
    document_id = Column(String(36), ForeignKey("documents.document_id"), nullable=True)
    evidence_id = Column(String(36), ForeignKey("evidence_sources.evidence_id"), nullable=True)
    claim_text = Column(Text, nullable=False)
    claim_type = Column(String(50), default="FACTUAL_ASSERTION")  # IDENTITY, FINANCIAL, COMPLIANCE, REPUTATION, etc.
    status = Column(String(30), default="SUPPORTED")  # SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE
    confidence_score = Column(Float, default=0.90)
    evidence_snippet = Column(Text, nullable=True)
    source_doc_name = Column(String(255), nullable=True)
    model_version = Column(String(50), default="v2.0.0-trust-core")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    analysis = relationship("AnalysisResult", back_populates="claims")
    reviewer_actions = relationship("ReviewerAction", back_populates="claim")

class ReviewerAction(Base):
    __tablename__ = "reviewer_actions"

    review_id = Column(String(36), primary_key=True, default=generate_uuid)
    claim_id = Column(String(36), ForeignKey("claims.claim_id"), nullable=False)
    reviewer_id = Column(String(36), nullable=False)
    action = Column(String(50), nullable=False)  # APPROVED, OVERRIDDEN, REJECTED, FLAGGED
    comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    claim = relationship("Claim", back_populates="reviewer_actions")

class RiskReport(Base):
    __tablename__ = "risk_reports"

    report_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    generated_by = Column(String(100), default="VendorGuard Engine")
    overall_risk_score = Column(Float, nullable=True)
    risk_breakdown = Column(JSON, default=dict)
    key_findings = Column(JSON, default=list)
    recommendation = Column(Text, nullable=True)
    report_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="risk_reports")

class TenderEvaluation(Base):
    """Persisted RFQ award decision: bids, weights and the ranked outcome are
    stored verbatim so every award recommendation is auditable afterwards."""
    __tablename__ = "tender_evaluations"

    tender_id = Column(String(36), primary_key=True, default=generate_uuid)
    quantity = Column(Integer, nullable=False)
    target_unit_price = Column(Float, nullable=True)
    deadline_days = Column(Integer, nullable=True)
    created_by = Column(String(36), nullable=True)
    result_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class EntityRelation(Base):
    __tablename__ = "entity_relations"

    relation_id = Column(String(36), primary_key=True, default=generate_uuid)
    source_entity = Column(String(200), nullable=False)
    relation_type = Column(String(50), nullable=False)  # HAS_DIRECTOR, SHARED_DIRECTOR, REGISTERED_AT, USES_BANK
    target_entity = Column(String(200), nullable=False)
    confidence = Column(Float, default=1.0)
    evidence_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuditEvent(Base):
    __tablename__ = "audit_events"

    event_id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    action = Column(String(100), nullable=False)
    object_id = Column(String(100), nullable=False)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="audit_events")

class PipelineJob(Base):
    __tablename__ = "pipeline_jobs"

    job_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    status = Column(String(30), default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    current_stage = Column(String(50), default="UPLOAD")  # UPLOAD, VALIDATE, OCR, EXTRACT, NORMALISE, CHECKS, ASSESS, REPORT
    stages_data = Column(JSON, default=dict)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="pipeline_jobs")

class SupplierInvite(Base):
    __tablename__ = "supplier_invites"

    invite_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    invite_token = Column(String(64), unique=True, nullable=False, index=True)
    created_by = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    required_docs = Column(JSON, default=list)  # ["GST_CERT", "PAN_CARD", "INCORPORATION", "BANK_STATEMENT", "ISO_CERT"]
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="invites")

class SupplierTimeline(Base):
    __tablename__ = "supplier_timelines"

    timeline_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # DOCUMENT_UPLOADED, ANALYSIS_RUN, REVIEW_DECIDED, STATUS_CHANGED, EXPIRY_WARNING
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="timeline_events")

class ApiKey(Base):
    __tablename__ = "api_keys"

    key_id = Column(String(36), primary_key=True, default=generate_uuid)
    key_hash = Column(String(64), unique=True, nullable=False, index=True)
    key_prefix = Column(String(16), nullable=False)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    organization = Column(String(200), nullable=False, index=True)
    scopes = Column(JSON, default=list)  # ["read:reports", "write:documents", "admin"]
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    endpoint_id = Column(String(36), primary_key=True, default=generate_uuid)
    organization = Column(String(200), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    secret = Column(String(100), nullable=False)
    events = Column(JSON, default=list)  # ["analysis.completed", "review.decided", "certificate.expiring"]
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class PolicyRule(Base):
    __tablename__ = "policy_rules"

    policy_id = Column(String(36), primary_key=True, default=generate_uuid)
    organization = Column(String(200), default="GLA Enterprise", index=True)
    rule_name = Column(String(100), nullable=False)
    risk_level = Column(String(20), nullable=False)  # HIGH, MEDIUM, LOW
    required_approvals = Column(Integer, default=1)
    block_auto_onboard = Column(Integer, default=1)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EvalBenchmarkRun(Base):
    __tablename__ = "eval_benchmark_runs"

    run_id = Column(String(36), primary_key=True, default=generate_uuid)
    run_type = Column(String(50), nullable=False)  # SYNTHETIC_BENCHMARK
    metrics = Column(JSON, default=dict)
    sample_count = Column(Integer, default=0)
    disclaimer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
