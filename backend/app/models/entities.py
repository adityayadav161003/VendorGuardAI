import uuid
from datetime import datetime
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
    created_at = Column(DateTime, default=datetime.utcnow)

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
    created_by = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="supplier", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="supplier", cascade="all, delete-orphan")
    risk_reports = relationship("RiskReport", back_populates="supplier", cascade="all, delete-orphan")

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
    upload_time = Column(DateTime, default=datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.utcnow)

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
    retrieved_at = Column(DateTime, default=datetime.utcnow)

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    analysis_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    risk_score = Column(Float, default=50.0)  # 0 to 100
    risk_level = Column(String(20), default="MEDIUM")  # LOW, MEDIUM, HIGH
    summary = Column(Text, nullable=True)
    risk_breakdown = Column(JSON, default=dict)  # Identity, Document, Financial, Operational, Network, Reputation
    key_findings = Column(JSON, default=list)
    model_version = Column(String(50), default="v1.0-rules-baseline")
    generated_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="analysis_results")
    claims = relationship("Claim", back_populates="analysis", cascade="all, delete-orphan")

class Claim(Base):
    __tablename__ = "claims"

    claim_id = Column(String(36), primary_key=True, default=generate_uuid)
    analysis_id = Column(String(36), ForeignKey("analysis_results.analysis_id"), nullable=False)
    document_id = Column(String(36), ForeignKey("documents.document_id"), nullable=True)
    evidence_id = Column(String(36), ForeignKey("evidence_sources.evidence_id"), nullable=True)
    claim_text = Column(Text, nullable=False)
    claim_type = Column(String(50), default="VERIFICATION")  # IDENTITY, FINANCIAL, COMPLIANCE, REPUTATION
    status = Column(String(30), default="SUPPORTED")  # SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE
    confidence_score = Column(Float, default=0.90)
    created_at = Column(DateTime, default=datetime.utcnow)

    analysis = relationship("AnalysisResult", back_populates="claims")
    reviewer_actions = relationship("ReviewerAction", back_populates="claim")

class ReviewerAction(Base):
    __tablename__ = "reviewer_actions"

    review_id = Column(String(36), primary_key=True, default=generate_uuid)
    claim_id = Column(String(36), ForeignKey("claims.claim_id"), nullable=False)
    reviewer_id = Column(String(36), nullable=False)
    action = Column(String(50), nullable=False)  # APPROVED, OVERRIDDEN, REJECTED, FLAGGED
    comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    claim = relationship("Claim", back_populates="reviewer_actions")

class RiskReport(Base):
    __tablename__ = "risk_reports"

    report_id = Column(String(36), primary_key=True, default=generate_uuid)
    supplier_id = Column(String(36), ForeignKey("suppliers.supplier_id"), nullable=False)
    generated_by = Column(String(100), default="VendorGuard Engine")
    overall_risk_score = Column(Float, nullable=False)
    risk_breakdown = Column(JSON, default=dict)
    key_findings = Column(JSON, default=list)
    recommendation = Column(Text, nullable=True)
    report_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    supplier = relationship("Supplier", back_populates="risk_reports")

class EntityRelation(Base):
    __tablename__ = "entity_relations"

    relation_id = Column(String(36), primary_key=True, default=generate_uuid)
    source_entity = Column(String(200), nullable=False)
    relation_type = Column(String(50), nullable=False)  # HAS_DIRECTOR, SHARED_DIRECTOR, REGISTERED_AT, USES_BANK
    target_entity = Column(String(200), nullable=False)
    confidence = Column(Float, default=1.0)
    evidence_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditEvent(Base):
    __tablename__ = "audit_events"

    event_id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=True)
    action = Column(String(100), nullable=False)
    object_id = Column(String(100), nullable=False)
    details = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_events")

# Core supplier definition

# Document storage schema

# Evidence and claim models

# Graph relations and assessment models

# Foreign key indexes
# UUID helper function
