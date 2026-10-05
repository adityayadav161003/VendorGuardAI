"""
Analysis & Risk Report API.

The pipeline is document-driven: it derives every profile attribute (GSTIN,
PAN, bank holder, certificate expiry, directors, vintage) from the entities
extracted out of the supplier's *uploaded* documents, falls back to permitted
demo-fixture evidence only for seeded demo suppliers, and verifies every
sentence it produces against the unified evidence pool before returning it.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import html

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse, HTMLResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import (
    Supplier, Document, ExtractedEntity, AnalysisResult, Claim,
    EvidenceSource, RiskReport, ReviewerAction,
)
from app.schemas.analysis import (
    AnalysisReportResponse,
    KeyFinding,
    ClaimVerification,
    CompareSuppliersRequest,
    AlertResponse,
)
from app.services.consistency import consistency_service
from app.services.graph_engine import graph_engine
from app.services.risk_engine import risk_engine
from app.services.claim_verifier import claim_verifier_service
from app.services.evidence_store import evidence_store
from app.services.audit import record_event
from app.core.security import get_current_user, require_roles
from app.models.entities import User
from data.fixtures.demo_data import DEMO_SUPPLIERS

router = APIRouter()

CURRENT_YEAR = datetime.now(timezone.utc).year


def _resolve_supplier(db: Session, supplier_id: str) -> Supplier:
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


def _latest_entity_value(entities: List[ExtractedEntity], entity_type: str) -> Optional[ExtractedEntity]:
    """Most recently extracted entity of a type (documents ordered by upload time)."""
    matches = [e for e in entities if e.entity_type == entity_type]
    return matches[-1] if matches else None


def _compose_summary(
    supplier: Supplier,
    profile: Dict[str, Any],
    consistency_findings: List[Dict[str, Any]],
    network_signals: List[Dict[str, Any]],
    document_count: int,
    data_source: str,
    unreadable_count: int = 0,
    entity_count: int = 0,
) -> str:
    """
    Builds the analyst summary from actual findings so that every sentence is
    checkable against the evidence pool by the claim verifier (AC4).
    """
    sentences: List[str] = []
    name = supplier.name
    gstin = profile.get("gstin")
    pan = profile.get("pan")

    if data_source == "NO_EVIDENCE":
        return (
            f"No documents or external evidence are available for {name}; the assessment is "
            f"limited and manual review is required before any onboarding decision."
        )

    if data_source == "UPLOADED_DOCUMENTS":
        if unreadable_count and unreadable_count >= document_count:
            return (
                f"{document_count} document(s) were submitted for {name} but none of them "
                f"could be read (scanned image without OCR, encrypted or empty file). No "
                f"content was verified from the uploads; the assessment is not evidence-backed "
                f"and manual review or a readable copy is required before any onboarding decision."
            )
        if unreadable_count:
            sentences.append(
                f"{document_count} document(s) were submitted for {name}, of which "
                f"{unreadable_count} could not be read and were excluded from verification."
            )
        else:
            sentences.append(
                f"{document_count} document(s) were submitted for {name} and analyzed for cross-document consistency."
            )
        if entity_count == 0:
            sentences.append(
                "No identifiers such as GSTIN, PAN, CIN or bank details could be extracted "
                "from the submitted content, so no identity, financial or compliance checks "
                "could be performed."
            )

    if gstin and pan:
        mismatch = any(f.get("conflict_type") == "GSTIN_PAN_MISMATCH" for f in consistency_findings)
        if mismatch:
            sentences.append(
                f"The GSTIN {gstin} does not embed the provided PAN {pan}, indicating inconsistent tax identity records."
            )
        else:
            sentences.append(
                f"The GSTIN {gstin} is documented and embeds the matching PAN {pan}."
            )

    conflicting = [f for f in consistency_findings if str(f.get("conflict_type", "")).startswith("CONFLICTING_")]
    for f in conflicting:
        sentences.append(f["message"] if f["message"].endswith((".", "!", "?")) else f["message"] + ".")

    holder = profile.get("bank_holder")
    if holder:
        mismatch = any(f.get("conflict_type") == "BANK_NAME_MISMATCH" for f in consistency_findings)
        if mismatch:
            sentences.append(
                f"The bank account is held in the name of {holder}, which does not match the registered company name {name}."
            )
        else:
            sentences.append(
                f"The bank account is held in the name of {holder}, consistent with the registered company name."
            )

    expiry_sentence = profile.get("expiry_sentence")
    if expiry_sentence:
        sentences.append(expiry_sentence)

    shared = [s for s in network_signals if s.get("type") == "SHARED_DIRECTOR_NETWORK"]
    if shared:
        message = shared[0].get("message", "A shared director network was detected across related entities.")
        sentences.append(message if message.endswith((".", "!", "?")) else message + ".")
    elif profile.get("directors"):
        sentences.append(
            f"Director {profile['directors'][0]} is documented in the submitted records."
        )

    has_warnings = (
        any(f.get("severity") in ("warning", "danger") for f in consistency_findings)
        or bool(shared)
        or (data_source == "UPLOADED_DOCUMENTS" and (entity_count == 0 or unreadable_count > 0))
    )
    if has_warnings:
        sentences.append(
            "I recommend manual verification of the flagged discrepancies before onboarding."
        )
    else:
        sentences.append(
            "No blocking discrepancies were detected in the available evidence."
        )

    return " ".join(sentences)


def _persist_analysis(
    db: Session,
    supplier: Supplier,
    report: AnalysisReportResponse,
    evidence_pool: List[Dict[str, Any]],
) -> Dict[str, str]:
    """Persists evidence items, the analysis result and its verified claims.

    Returns a mapping of verifier claim ids -> persisted Claim ids so the
    response exposes reviewable database identifiers.
    """
    for ev in evidence_pool:
        exists = db.query(EvidenceSource).filter(EvidenceSource.evidence_id == ev["evidence_id"]).first()
        if not exists:
            db.add(EvidenceSource(
                evidence_id=ev["evidence_id"],
                supplier_id=supplier.supplier_id,
                source_type=ev.get("source_type", "DOCUMENT"),
                title=ev.get("title", "Source"),
                url=ev.get("url"),
                snippet=ev.get("snippet", ""),
                reliability_score=ev.get("reliability_score", 0.9),
            ))

    db.add(AnalysisResult(
        supplier_id=supplier.supplier_id,
        risk_score=report.risk_score,
        risk_level=report.risk_level,
        summary=report.summary,
        risk_breakdown=report.risk_breakdown.model_dump(),
        key_findings=[f.model_dump() for f in report.key_findings],
        model_version=report.model_version,
        data_source=report.data_source,
        document_count=report.document_count,
        generated_at=report.generated_at,
    ))
    db.commit()

    analysis = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.supplier_id == supplier.supplier_id)
        .order_by(AnalysisResult.generated_at.desc())
        .first()
    )

    evidence_doc_map = {ev["evidence_id"]: ev.get("document_id") for ev in evidence_pool}
    claim_id_map: Dict[str, str] = {}
    for vc in report.claims:
        row = Claim(
            analysis_id=analysis.analysis_id,
            evidence_id=vc.evidence_id,
            document_id=evidence_doc_map.get(vc.evidence_id or ""),
            claim_text=vc.claim_text,
            claim_type=vc.claim_type,
            status=vc.status,
            confidence_score=vc.confidence_score,
            evidence_snippet=vc.evidence_snippet,
            source_doc_name=vc.source_doc_name,
        )
        db.add(row)
        db.flush()
        claim_id_map[vc.claim_id] = row.claim_id
    db.commit()
    return claim_id_map


def _stored_report(db: Session, supplier: Supplier) -> Optional[AnalysisReportResponse]:
    """Rebuilds the report view from the most recent persisted analysis."""
    analysis = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.supplier_id == supplier.supplier_id)
        .order_by(AnalysisResult.generated_at.desc())
        .first()
    )
    if not analysis:
        return None

    claims = db.query(Claim).filter(Claim.analysis_id == analysis.analysis_id).all()
    latest_review: Dict[str, ReviewerAction] = {}
    if claims:
        actions = (
            db.query(ReviewerAction)
            .filter(ReviewerAction.claim_id.in_([c.claim_id for c in claims]))
            .order_by(ReviewerAction.reviewed_at.desc())
            .all()
        )
        for action in actions:
            latest_review.setdefault(action.claim_id, action)

    claim_models = [
        ClaimVerification(
            claim_id=c.claim_id,
            claim_text=c.claim_text,
            claim_type=c.claim_type,
            status=c.status,
            confidence_score=c.confidence_score,
            evidence_snippet=c.evidence_snippet,
            source_doc_name=c.source_doc_name,
            evidence_id=c.evidence_id,
            reviewer_state=(latest_review[c.claim_id].action if c.claim_id in latest_review else "PENDING"),
        )
        for c in claims
    ]

    return AnalysisReportResponse(
        analysis_id=analysis.analysis_id,
        supplier_id=analysis.supplier_id,
        supplier_name=supplier.name,
        risk_score=analysis.risk_score,
        risk_level=analysis.risk_level,
        summary=analysis.summary or "",
        risk_breakdown=analysis.risk_breakdown or {},
        key_findings=[KeyFinding(**f) for f in (analysis.key_findings or [])],
        claims=claim_models,
        model_version=analysis.model_version,
        generated_at=analysis.generated_at,
        data_source=analysis.data_source or "NO_EVIDENCE",
        document_count=analysis.document_count or 0,
    )


def run_analysis(db: Session, supplier: Supplier) -> AnalysisReportResponse:
    """Executes the end-to-end document-driven evaluation pipeline."""
    pool = evidence_store.build_evidence_pool(db, supplier.supplier_id)
    evidence_pool = pool["evidence_pool"]
    entities = pool["entities"]
    document_count = pool["document_count"]
    unreadable_count = pool.get("unreadable_count", 0)
    entity_count = len(entities)
    data_source = pool["data_source"]

    demo_match = next((d for d in DEMO_SUPPLIERS if d["supplier_id"] == supplier.supplier_id), None)

    # Document name map for cross-document provenance
    docs = db.query(Document).filter(Document.supplier_id == supplier.supplier_id).all()
    doc_names = {d.document_id: d.file_name for d in docs}

    entity_dicts = [
        {
            "entity_type": e.entity_type,
            "entity_value": e.entity_value,
            "document_name": doc_names.get(e.document_id, "uploaded document"),
            "page_number": e.page_number or 1,
        }
        for e in entities
    ]

    # 1. Consistency checks (AC3)
    consistency_findings: List[Dict[str, Any]] = []
    if entity_dicts:
        consistency_findings.extend(consistency_service.check_entity_conflicts_across_documents(entity_dicts))

    profile: Dict[str, Any] = {}
    if demo_match:
        gstin = demo_match.get("gstin")
        pan = demo_match.get("pan")
        bank_holder = demo_match.get("bank_account", {}).get("holder_name")
        profile.update(
            gstin=gstin,
            pan=pan,
            bank_holder=bank_holder,
            identity_message="GST registration verified against the permitted GST portal evidence",
            identity_source="GST Portal & Registration Certificate",
            registration_message="Company incorporation verified against MCA21 registry evidence",
            registration_source="MCA21 Registry",
        )
        gst_pan_check = consistency_service.check_gstin_pan_consistency(gstin, pan)
        if gst_pan_check:
            consistency_findings.append(gst_pan_check)
        bank_check = consistency_service.check_bank_name_consistency(supplier.name, bank_holder)
        if bank_check:
            consistency_findings.append(bank_check)
        iso_expiry = (demo_match.get("iso_cert") or {}).get("expiry_date")
        if iso_expiry:
            expiry_check = consistency_service.check_certificate_expiry(iso_expiry)
            if expiry_check:
                consistency_findings.append(expiry_check)
                profile["expiry_sentence"] = expiry_check["message"]
    else:
        # Document-driven profile: no invented defaults, only what was extracted
        gstin_ent = _latest_entity_value(entities, "GSTIN")
        pan_ent = _latest_entity_value(entities, "PAN")
        cin_ent = _latest_entity_value(entities, "CIN")
        year_ent = _latest_entity_value(entities, "INCORPORATION_YEAR")
        holder_ent = _latest_entity_value(entities, "ACCOUNT_HOLDER")

        gstin = gstin_ent.entity_value if gstin_ent else None
        pan = pan_ent.entity_value if pan_ent else None
        profile.update(
            gstin=gstin,
            pan=pan,
            bank_holder=holder_ent.entity_value if holder_ent else None,
        )

        if gstin and pan:
            gst_pan_check = consistency_service.check_gstin_pan_consistency(gstin, pan)
            already_flagged = any(f.get("conflict_type") == "GSTIN_PAN_MISMATCH" for f in consistency_findings)
            if already_flagged or (gst_pan_check and gst_pan_check["conflict_type"] == "GSTIN_PAN_MISMATCH"):
                if gst_pan_check and not already_flagged:
                    consistency_findings.append(gst_pan_check)
                profile["gstin_verified"] = False
            else:
                profile["gstin_verified"] = True
                profile["identity_message"] = (
                    f"Tax identity documented in submitted files: PAN {pan} is embedded in GSTIN {gstin}"
                )
                profile["identity_source"] = "Submitted documents"
        elif gstin or pan:
            profile["gstin_verified"] = True
            profile["identity_message"] = "Partial tax identity extracted from submitted documents"
            profile["identity_source"] = "Submitted documents"
        else:
            profile["gstin_verified"] = False

        incorporation_documented = cin_ent is not None or year_ent is not None
        profile["incorporation_verified"] = incorporation_documented
        if incorporation_documented:
            profile["registration_message"] = "Company registration documented in submitted files"
            profile["registration_source"] = "Submitted documents"

        years = None
        if year_ent:
            try:
                years = CURRENT_YEAR - int(year_ent.entity_value)
                if not 0 < years < 120:
                    years = None
            except (TypeError, ValueError):
                years = None
        profile["years_in_business"] = years

        expiry_value = consistency_service.earliest_expiry_date(entity_dicts)
        if expiry_value:
            expiry_check = consistency_service.check_certificate_expiry(expiry_value)
            if expiry_check:
                consistency_findings.append(expiry_check)
                profile["expiry_sentence"] = expiry_check["message"]

    directors: List[Dict[str, Any]] = []
    if demo_match:
        directors.extend(demo_match.get("directors", []))
    director_entities = [e for e in entities if e.entity_type == "DIRECTOR"]
    fixture_director_names = {d["name"].lower() for d in demo_match.get("directors", [])} if demo_match else set()
    for ent in director_entities:
        if ent.entity_value.lower() not in fixture_director_names:
            directors.append({"name": ent.entity_value, "other_companies": []})
    if directors:
        profile["directors"] = [d["name"] for d in directors]

    # 2. Graph intelligence (AC6)
    graph_data = graph_engine.build_supplier_subgraph({
        "supplier_id": supplier.supplier_id,
        "name": supplier.name,
        "address": supplier.address,
        "status": supplier.status,
        "directors": directors,
    })
    network_signals = graph_data["summary"]["network_signals"]

    # 3. Multi-vector risk scoring (AC5)
    has_document_evidence = document_count > 0 or data_source == "DEMO_FIXTURES"
    risk_evaluation = risk_engine.evaluate_supplier_risk(
        supplier_profile=profile,
        consistency_findings=consistency_findings,
        network_signals=network_signals,
        external_evidence=evidence_pool,
        has_document_evidence=has_document_evidence,
        unreadable_documents=unreadable_count,
        total_documents=document_count,
        extracted_entity_count=entity_count,
        data_source=data_source,
    )

    # 4. Grounded analyst summary + claim-level verification (AC4)
    summary_text = _compose_summary(
        supplier, profile, consistency_findings, network_signals, document_count,
        data_source, unreadable_count=unreadable_count, entity_count=entity_count,
    )
    verified_claims = claim_verifier_service.verify_analyst_summary(summary_text, evidence_pool)

    claim_objects = [
        ClaimVerification(
            claim_id=vc["claim_id"],
            claim_text=vc["claim_text"],
            claim_type=vc["claim_type"],
            status=vc["status"],
            confidence_score=vc["confidence_score"],
            evidence_snippet=vc.get("evidence_snippet"),
            source_doc_name=vc.get("source_doc_name"),
            evidence_id=vc.get("evidence_id"),
            reviewer_state="PENDING",
        )
        for vc in verified_claims
    ]

    report = AnalysisReportResponse(
        analysis_id=f"anl-{supplier.supplier_id}-{int(datetime.now(timezone.utc).timestamp())}",
        supplier_id=supplier.supplier_id,
        supplier_name=supplier.name,
        risk_score=risk_evaluation["composite_score"],
        risk_level=risk_evaluation["risk_level"],
        summary=summary_text,
        risk_breakdown=risk_evaluation["breakdown"],
        key_findings=risk_evaluation["key_findings"],
        claims=claim_objects,
        model_version="v1.1-document-driven-baseline",
        generated_at=datetime.now(timezone.utc),
        data_source=data_source,
        document_count=document_count,
    )

    claim_id_map = _persist_analysis(db, supplier, report, evidence_pool)
    for vc in report.claims:
        if vc.claim_id in claim_id_map:
            vc.claim_id = claim_id_map[vc.claim_id]

    # Auto-flag only until a human decides
    if supplier.status == "REVIEW_PENDING":
        if report.risk_level == "HIGH":
            supplier.status = "FLAGGED"
        elif report.risk_level == "LOW":
            supplier.status = "VERIFIED"
        db.commit()

    record_event(db, "ANALYSIS_RUN", supplier.supplier_id, details={
        "risk_score": report.risk_score,
        "data_source": report.data_source,
        "documents": report.document_count,
    })
    db.commit()

    return report


@router.post("/{supplier_id}/analyze", response_model=AnalysisReportResponse)
def analyze_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-runs the full pipeline: consistency → graph → risk → claim verification."""
    supplier = _resolve_supplier(db, supplier_id)
    return run_analysis(db, supplier)


@router.get("/{supplier_id}/report", response_model=AnalysisReportResponse)
def get_supplier_report(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the most recent stored analysis, running it first if none exists."""
    supplier = _resolve_supplier(db, supplier_id)
    stored = _stored_report(db, supplier)
    if stored:
        return stored
    return run_analysis(db, supplier)


@router.get("/{supplier_id}/alerts", response_model=List[AlertResponse])
def get_supplier_alerts(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actionable alerts derived from the latest analysis findings."""
    supplier = _resolve_supplier(db, supplier_id)
    report = _stored_report(db, supplier) or run_analysis(db, supplier)
    alerts = [
        AlertResponse(
            severity=f.severity,
            category=f.category,
            message=f.message,
            source_reference=f.source_reference,
            generated_at=report.generated_at,
        )
        for f in report.key_findings
        if f.severity in ("warning", "danger")
    ]
    return alerts


@router.get("/{supplier_id}/report/export")
def export_supplier_report(
    supplier_id: str,
    format: str = Query(default="html"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Downloads the evidence-linked report as JSON or a self-contained HTML file."""
    supplier = _resolve_supplier(db, supplier_id)
    report = _stored_report(db, supplier) or run_analysis(db, supplier)

    db.add(RiskReport(
        supplier_id=supplier.supplier_id,
        overall_risk_score=report.risk_score,
        risk_breakdown=report.risk_breakdown.model_dump(),
        key_findings=[f.model_dump() for f in report.key_findings],
        recommendation=report.summary,
        report_url=f"/api/suppliers/{supplier_id}/report/export?format={format}",
    ))
    record_event(db, "REPORT_EXPORTED", supplier.supplier_id, details={"format": format})
    db.commit()

    if format == "json":
        payload = report.model_dump(mode="json")
        return JSONResponse(
            content=payload,
            headers={"Content-Disposition": f'attachment; filename="vendorguard-report-{supplier_id}.json"'},
        )

    severity_colors = {"success": "#16a34a", "info": "#2563eb", "warning": "#d97706", "danger": "#dc2626"}
    status_colors = {"SUPPORTED": "#16a34a", "CONTRADICTED": "#dc2626", "INSUFFICIENT_EVIDENCE": "#d97706"}
    level_colors = {"LOW": "#16a34a", "MEDIUM": "#d97706", "HIGH": "#dc2626"}
    esc = html.escape  # every document-derived string is escaped (stored-XSS defence)
    breakdown_rows = "".join(
        f"<tr><td>{esc(k.capitalize())}</td><td>{v}</td></tr>" for k, v in report.risk_breakdown.model_dump().items()
    )
    findings_html = "".join(
        f'<li style="color:{severity_colors.get(f.severity, "#111")}">[{esc(f.severity.upper())}] ({esc(f.category)}) '
        f"{esc(f.message)} <em>— {esc(f.source_reference or '')}</em></li>"
        for f in report.key_findings
    )
    claims_html = "".join(
        f'<li style="color:{status_colors.get(c.status, "#111")}"><b>{esc(c.status)}</b> ({c.confidence_score:.2f}, '
        f"reviewer: {esc(c.reviewer_state)}) — {esc(c.claim_text)}<br><small>Source: {esc(c.source_doc_name or 'n/a')} | "
        f"{esc((c.evidence_snippet or '')[:180])}</small></li>"
        for c in report.claims
    )
    generated = report.generated_at.strftime("%d %b %Y %H:%M %Z") if report.generated_at else ""
    html_doc = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>VendorGuard AI Report - {esc(report.supplier_name)}</title>
<style>body{{font-family:'Segoe UI',Arial,sans-serif;max-width:860px;margin:2rem auto;color:#111}}
h1{{border-bottom:3px solid #2563eb;padding-bottom:.4rem}} .score{{font-size:2.4rem;font-weight:700}}
table{{border-collapse:collapse}} td{{border:1px solid #ddd;padding:6px 14px}}
li{{margin:.5rem 0}} small{{color:#555}} .meta{{color:#666;font-size:.85rem}}</style></head>
<body>
<h1>VendorGuard AI — Supplier Risk Report</h1>
<p><b>{esc(report.supplier_name)}</b> <span class="meta">(ID {esc(report.supplier_id)}, generated {esc(generated)}, model {esc(report.model_version)})</span></p>
<p class="score">{report.risk_score}/100 <span style="font-size:1.1rem;color:{level_colors.get(report.risk_level, '#111')}">{esc(report.risk_level)} RISK</span></p>
<p class="meta">Evidence basis: {esc(report.data_source)} · {report.document_count} uploaded document(s)</p>
<h2>Analyst Summary</h2><p>{esc(report.summary)}</p>
<h2>Risk Breakdown</h2><table>{breakdown_rows}</table>
<h2>Key Findings</h2><ul>{findings_html or '<li>No findings.</li>'}</ul>
<h2>Verified Claims</h2><ul>{claims_html or '<li>No claims.</li>'}</ul>
<p class="meta">Decision-support output only — not a legal determination. Every claim links to the evidence it was checked against; claims marked INSUFFICIENT_EVIDENCE remain unverified.</p>
</body></html>"""
    return HTMLResponse(
        content=html_doc,
        headers={"Content-Disposition": f'inline; filename="vendorguard-report-{supplier_id}.html"'},
    )


@router.post("/compare")
def compare_suppliers(
    payload: CompareSuppliersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Side-by-side comparative risk evaluation for procurement tender review."""
    if len(payload.supplier_ids) > 10:
        raise HTTPException(status_code=422, detail="Compare at most 10 suppliers at a time.")
    comparisons = []
    for sid in payload.supplier_ids:
        try:
            supplier = _resolve_supplier(db, sid)
            comparisons.append(run_analysis(db, supplier))
        except HTTPException:
            continue
    return {"comparisons": comparisons}
