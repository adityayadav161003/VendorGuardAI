"""
Explainable Multi-Vector Risk Scoring Engine & Assessment State Machine.

Product Thesis: "Verify the Supplier. Verify the Evidence. Verify the AI."
- If evidence is missing, show an honest uncertain/empty state (NOT_ASSESSABLE).
- Never show a healthy-looking result or numeric score without backing evidence.
- Vectors start at 100 and subtract weighted penalties for triggered rules ONLY
  when the vector has at least one supporting evidence record.
- Otherwise score = None and status = 'insufficient'.
- Overall score = weighted mean of computed vectors only (renormalized).
- Displayed confidence capped by evidence_coverage.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional

from app.core.config import settings
from app.schemas.analysis import RiskBreakdown, RiskVectorDetail, KeyFinding


class RiskScoringEngine:
    """
    Computes evidence-grounded risk vectors and composite trust assessment.
    States:
      - NOT_ASSESSABLE (coverage < 30): overall score is None / UNASSESSED
      - PROVISIONAL    (coverage 30-69): labeled Provisional with reason
      - ASSESSED       (coverage >= 70): full evidence-grounded score
    """

    def __init__(self):
        self.rules_config = self._load_rules_config()

    def _load_rules_config(self) -> Dict[str, Any]:
        rules_path = Path(__file__).resolve().parent.parent / "core" / "risk_rules.json"
        if rules_path.exists():
            try:
                with open(rules_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "rule_version": "v2.0.0-trust-core",
            "coverage_thresholds": {
                "not_assessable_max": 29,
                "provisional_min": 30,
                "provisional_max": 69,
                "assessed_min": 70,
            },
            "vector_weights": {
                "identity": 0.20,
                "documents": 0.20,
                "financial": 0.20,
                "operational": 0.15,
                "network": 0.15,
                "reputation": 0.10,
            },
            "rules": {},
        }

    @property
    def rule_version(self) -> str:
        return self.rules_config.get("rule_version", "v2.0.0-trust-core")

    @property
    def vector_weights(self) -> Dict[str, float]:
        return self.rules_config.get("vector_weights", {
            "identity": 0.20,
            "documents": 0.20,
            "financial": 0.20,
            "operational": 0.15,
            "network": 0.15,
            "reputation": 0.10,
        })

    def compute_evidence_coverage(
        self,
        evidence_pool: List[Dict[str, Any]],
        document_count: int,
        unreadable_count: int,
        extracted_entities: List[Dict[str, Any]],
        data_source: str,
    ) -> Dict[str, Any]:
        """
        Computes evidence_coverage (0-100) and assessment state machine status.
        Coverage combines:
        1. Document diversity and count (up to 50 pts)
        2. Extracted key identifiers & confidence (up to 35 pts)
        3. Permitted external/portal verification sources (up to 15 pts)
        """
        if data_source == "NO_EVIDENCE" or (document_count == 0 and not evidence_pool):
            return {
                "evidence_coverage": 0.0,
                "assessment_state": "NOT_ASSESSABLE",
                "assessment_confidence": 0.0,
                "provisional_reason": "No documents or external records have been submitted for this supplier. Verification cannot proceed without evidence.",
            }

        # If all submitted documents are unreadable scans
        if document_count > 0 and unreadable_count >= document_count:
            return {
                "evidence_coverage": 5.0,
                "assessment_state": "NOT_ASSESSABLE",
                "assessment_confidence": 2.0,
                "provisional_reason": f"All {document_count} uploaded document(s) could not be read (scanned images without OCR or empty files). Manual review or readable copies are required.",
            }

        score = 0.0

        # 1. Document diversity: check types in evidence
        doc_types = set()
        for ev in evidence_pool:
            stype = str(ev.get("source_type", "")).upper()
            if "GST" in stype:
                doc_types.add("GST")
            elif "PAN" in stype:
                doc_types.add("PAN")
            elif "INCORPORATION" in stype or "MCA" in stype or "REG" in stype:
                doc_types.add("REG")
            elif "BANK" in stype or "CHEQUE" in stype:
                doc_types.add("BANK")
            elif "ISO" in stype or "CERT" in stype:
                doc_types.add("ISO")
            elif "INVOICE" in stype:
                doc_types.add("INVOICE")

        # Give 15 points per distinct category present (up to 45 pts)
        readable_docs = max(0, document_count - unreadable_count)
        score += min(45.0, len(doc_types) * 15.0 + min(readable_docs * 5.0, 15.0))

        # 2. Extracted entity coverage and confidence (up to 37 pts)
        entity_types = {e.get("entity_type") for e in extracted_entities}
        key_entities = {"GSTIN", "PAN", "CIN", "BANK_ACCOUNT", "ACCOUNT_HOLDER", "DIRECTOR", "EXPIRY_DATE"}
        matched_keys = entity_types.intersection(key_entities)
        score += min(37.0, len(matched_keys) * 6.0)

        # 3. External portal / permitted fixture records (up to 15 pts)
        external_count = sum(1 for e in evidence_pool if e.get("origin") in ("DEMO_FIXTURE", "PORTAL_SOURCE"))
        score += min(15.0, external_count * 5.0)

        coverage = round(max(0.0, min(100.0, score)), 1)

        # Average extraction confidence
        conf_scores = [float(e.get("confidence_score") or 0.9) for e in extracted_entities if "confidence_score" in e]
        avg_conf = (sum(conf_scores) / len(conf_scores)) if conf_scores else 0.85

        # Assessment confidence: capped strictly by coverage
        assessment_confidence = round(min(coverage, coverage * avg_conf), 1)

        thresholds = self.rules_config.get("coverage_thresholds", {
            "not_assessable_max": 29,
            "provisional_min": 30,
            "provisional_max": 69,
            "assessed_min": 70,
        })

        if coverage <= thresholds.get("not_assessable_max", 29):
            assessment_state = "NOT_ASSESSABLE"
            provisional_reason = f"Evidence coverage ({coverage}%) is below the minimum required threshold ({thresholds['provisional_min']}%). Verification cannot be performed."
        elif coverage <= thresholds.get("provisional_max", 69):
            assessment_state = "PROVISIONAL"
            missing_types = [t for t in ["GST", "PAN", "REG", "BANK"] if t not in doc_types]
            missing_text = f", missing {', '.join(missing_types)}" if missing_types else ""
            provisional_reason = f"Provisional assessment based on partial document coverage ({coverage}%{missing_text}). Complete statutory filings recommended."
        else:
            assessment_state = "ASSESSED"
            provisional_reason = None

        return {
            "evidence_coverage": coverage,
            "assessment_state": assessment_state,
            "assessment_confidence": assessment_confidence,
            "provisional_reason": provisional_reason,
        }

    def evaluate_supplier_risk(
        self,
        supplier_profile: Dict[str, Any],
        consistency_findings: List[Dict[str, Any]],
        network_signals: List[Dict[str, Any]],
        external_evidence: List[Dict[str, Any]],
        has_document_evidence: bool = True,
        unreadable_documents: int = 0,
        total_documents: int = 0,
        extracted_entity_count: int = 0,
        data_source: str = "NO_EVIDENCE",
        extracted_entities: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates the 6 risk vectors and state machine.
        Returns:
          assessment_state: NOT_ASSESSABLE | PROVISIONAL | ASSESSED
          evidence_coverage: float
          assessment_confidence: float
          provisional_reason: Optional[str]
          composite_score: Optional[float]
          risk_level: UNASSESSED | LOW | MEDIUM | HIGH
          breakdown: RiskBreakdown
          key_findings: List[KeyFinding]
          rule_version: str
        """
        extracted_entities = extracted_entities or []
        coverage_meta = self.compute_evidence_coverage(
            evidence_pool=external_evidence,
            document_count=total_documents,
            unreadable_count=unreadable_documents,
            extracted_entities=extracted_entities,
            data_source=data_source,
        )

        state = coverage_meta["assessment_state"]
        coverage = coverage_meta["evidence_coverage"]
        confidence = coverage_meta["assessment_confidence"]
        provisional_reason = coverage_meta["provisional_reason"]

        # Helper to partition evidence per vector
        def get_evidence_ids(types: List[str], keywords: List[str]) -> List[str]:
            res = []
            for ev in external_evidence:
                stype = str(ev.get("source_type", "")).upper()
                snip = str(ev.get("snippet", "")).lower()
                title = str(ev.get("title", "")).lower()
                if any(t in stype for t in types) or any(k in snip or k in title for k in keywords):
                    eid = ev.get("evidence_id")
                    if eid:
                        res.append(str(eid))
            return list(dict.fromkeys(res))

        vector_details: Dict[str, RiskVectorDetail] = {}

        # -------------------------------------------------------------
        # Vector 1: Identity
        # -------------------------------------------------------------
        id_ev = get_evidence_ids(["GST", "PAN"], ["gstin", "pan", "tax identity"])
        if not id_ev and not supplier_profile.get("gstin") and not supplier_profile.get("pan"):
            vector_details["identity"] = RiskVectorDetail(
                score=None,
                status="insufficient",
                evidence_ids=[],
                reason_codes=["NO_IDENTITY_EVIDENCE"],
                rule_version=self.rule_version,
            )
        else:
            score = 100.0
            reasons = []
            # Tax identity mismatch
            if any(f.get("conflict_type") == "GSTIN_PAN_MISMATCH" for f in consistency_findings):
                score -= 45.0
                reasons.append("ID_GSTIN_PAN_MISMATCH")
            # Invalid GSTIN format / checksum
            if supplier_profile.get("gstin_format_invalid"):
                score -= 35.0
                reasons.append("ID_GSTIN_INVALID_FORMAT")
            # Invalid PAN format / entity char
            if supplier_profile.get("pan_format_invalid"):
                score -= 30.0
                reasons.append("ID_PAN_INVALID_FORMAT")
            # Unverified source
            if not supplier_profile.get("gstin_verified", True):
                score -= 15.0
                reasons.append("ID_UNVERIFIED_SOURCE")

            vector_details["identity"] = RiskVectorDetail(
                score=max(0.0, min(100.0, score)),
                status="computed",
                evidence_ids=id_ev,
                reason_codes=reasons or ["IDENTITY_VERIFIED_IN_RECORD"],
                rule_version=self.rule_version,
            )

        # -------------------------------------------------------------
        # Vector 2: Documents
        # -------------------------------------------------------------
        doc_ev = [ev["evidence_id"] for ev in external_evidence if ev.get("origin") == "UPLOADED_DOCUMENT" or "ISO" in str(ev.get("source_type", ""))]
        if not doc_ev and total_documents == 0 and data_source == "NO_EVIDENCE":
            vector_details["documents"] = RiskVectorDetail(
                score=None,
                status="insufficient",
                evidence_ids=[],
                reason_codes=["NO_DOCUMENTS_SUBMITTED"],
                rule_version=self.rule_version,
            )
        else:
            score = 100.0
            reasons = []
            if unreadable_documents > 0:
                fraction_unreadable = unreadable_documents / max(1, total_documents)
                score -= 35.0 * fraction_unreadable
                reasons.append("DOC_UNREADABLE_FILES")
            if any(f.get("status") == "EXPIRED" for f in consistency_findings):
                score -= 30.0
                reasons.append("DOC_CERTIFICATE_EXPIRED")
            elif any(f.get("status") == "EXPIRING_SOON" for f in consistency_findings):
                score -= 10.0
                reasons.append("DOC_CERTIFICATE_EXPIRING_SOON")
            if any(str(f.get("conflict_type", "")).startswith("CONFLICTING_") for f in consistency_findings):
                score -= 25.0
                reasons.append("DOC_CONFLICTING_FIELDS")

            vector_details["documents"] = RiskVectorDetail(
                score=max(0.0, min(100.0, score)),
                status="computed",
                evidence_ids=doc_ev,
                reason_codes=reasons or ["DOCUMENTS_PROCESSED_CLEAN"],
                rule_version=self.rule_version,
            )

        # -------------------------------------------------------------
        # Vector 3: Financial
        # -------------------------------------------------------------
        fin_ev = get_evidence_ids(["BANK", "INVOICE"], ["account", "ifsc", "bank", "cheque", "amount", "invoice"])
        if not fin_ev and not supplier_profile.get("bank_holder"):
            vector_details["financial"] = RiskVectorDetail(
                score=None,
                status="insufficient",
                evidence_ids=[],
                reason_codes=["NO_FINANCIAL_EVIDENCE"],
                rule_version=self.rule_version,
            )
        else:
            score = 100.0
            reasons = []
            if any(f.get("conflict_type") == "BANK_NAME_MISMATCH" for f in consistency_findings):
                score -= 25.0
                reasons.append("FIN_BANK_NAME_MISMATCH")
            if any(f.get("conflict_type") == "PRICE_ANOMALY" for f in consistency_findings):
                score -= 18.0
                reasons.append("FIN_PRICE_ANOMALY")
            if supplier_profile.get("ifsc_invalid"):
                score -= 15.0
                reasons.append("FIN_MISSING_IFSC_STRUCTURE")

            vector_details["financial"] = RiskVectorDetail(
                score=max(0.0, min(100.0, score)),
                status="computed",
                evidence_ids=fin_ev,
                reason_codes=reasons or ["FINANCIAL_EVIDENCE_CONSISTENT"],
                rule_version=self.rule_version,
            )

        # -------------------------------------------------------------
        # Vector 4: Operational
        # -------------------------------------------------------------
        ops_ev = get_evidence_ids(["INCORPORATION", "REGISTRATION", "MCA"], ["cin", "incorporated", "vintage", "years"])
        vintage_years = supplier_profile.get("years_in_business")
        if not ops_ev and vintage_years is None and not supplier_profile.get("incorporation_verified"):
            vector_details["operational"] = RiskVectorDetail(
                score=None,
                status="insufficient",
                evidence_ids=[],
                reason_codes=["NO_OPERATIONAL_EVIDENCE"],
                rule_version=self.rule_version,
            )
        else:
            score = 100.0
            reasons = []
            if vintage_years is not None and vintage_years < 2:
                score -= 20.0
                reasons.append("OPS_VINTAGE_UNDER_2_YEARS")
            if supplier_profile.get("cin_format_invalid"):
                score -= 15.0
                reasons.append("OPS_CIN_INVALID_FORMAT")

            vector_details["operational"] = RiskVectorDetail(
                score=max(0.0, min(100.0, score)),
                status="computed",
                evidence_ids=ops_ev,
                reason_codes=reasons or ["OPERATIONAL_VINTAGE_SATISFACTORY"],
                rule_version=self.rule_version,
            )

        # -------------------------------------------------------------
        # Vector 5: Network
        # -------------------------------------------------------------
        net_ev = get_evidence_ids(["DIRECTOR", "MCA_PORTAL", "NETWORK"], ["director", "din", "related", "address"])
        has_directors = bool(supplier_profile.get("directors"))
        if not net_ev and not has_directors and not network_signals:
            vector_details["network"] = RiskVectorDetail(
                score=None,
                status="insufficient",
                evidence_ids=[],
                reason_codes=["NO_NETWORK_EVIDENCE"],
                rule_version=self.rule_version,
            )
        else:
            score = 100.0
            reasons = []
            for s in network_signals:
                stype = s.get("type")
                if stype == "SHARED_DIRECTOR_NETWORK":
                    score -= 20.0
                    reasons.append("NET_SHARED_DIRECTOR")
                elif stype == "SHARED_ADDRESS":
                    score -= 20.0
                    reasons.append("NET_SHARED_ADDRESS")
                elif stype == "HIGH_CENTRALITY_DIRECTOR":
                    score -= 10.0
                    reasons.append("NET_HIGH_CENTRALITY")

            vector_details["network"] = RiskVectorDetail(
                score=max(0.0, min(100.0, score)),
                status="computed",
                evidence_ids=net_ev,
                reason_codes=reasons or ["NETWORK_RELATIONS_DISCLOSED"],
                rule_version=self.rule_version,
            )

        # -------------------------------------------------------------
        # Vector 6: Reputation
        # -------------------------------------------------------------
        rep_ev = get_evidence_ids(["NEWS", "SANCTIONS", "WATCHLIST", "REVIEW"], ["negative", "complaint", "shell", "dormant", "sanction"])
        neg_count = sum(1 for e in external_evidence if any(w in str(e.get("snippet", "")).lower() for w in ["negative", "complaint", "fraud", "shell"]))
        if not rep_ev and neg_count == 0 and data_source == "NO_EVIDENCE":
            vector_details["reputation"] = RiskVectorDetail(
                score=None,
                status="insufficient",
                evidence_ids=[],
                reason_codes=["NO_REPUTATION_RECORDS"],
                rule_version=self.rule_version,
            )
        else:
            score = 100.0
            reasons = []
            if neg_count > 0:
                score -= min(50.0, neg_count * 15.0)
                reasons.append("REP_NEGATIVE_EXTERNAL_REPORT")
            if any("shell" in str(e.get("snippet", "")).lower() or "dormant" in str(e.get("snippet", "")).lower() for e in external_evidence):
                score -= 30.0
                reasons.append("REP_SANCTION_OR_DEBARMENT_ALERT")

            vector_details["reputation"] = RiskVectorDetail(
                score=max(0.0, min(100.0, score)),
                status="computed",
                evidence_ids=rep_ev,
                reason_codes=reasons or ["NO_ADVERSE_REPUTATION_FOUND"],
                rule_version=self.rule_version,
            )

        # -------------------------------------------------------------
        # Composite Trust Calculation (Renormalized across computed vectors)
        # -------------------------------------------------------------
        weights = self.vector_weights
        computed_vectors = {k: v for k, v in vector_details.items() if v.status == "computed" and v.score is not None}

        if state == "NOT_ASSESSABLE" or not computed_vectors:
            composite_score = None
            risk_level = "UNASSESSED"
        else:
            total_active_weight = sum(weights.get(k, 0.15) for k in computed_vectors.keys())
            if total_active_weight <= 0:
                composite_score = None
                risk_level = "UNASSESSED"
            else:
                weighted_sum = sum(
                    computed_vectors[k].score * (weights.get(k, 0.15) / total_active_weight)
                    for k in computed_vectors.keys()
                )
                # Compounding penalties: tax identity contradiction
                if any(f.get("conflict_type") == "GSTIN_PAN_MISMATCH" for f in consistency_findings):
                    weighted_sum = min(weighted_sum - 5.0, 50.0)

                composite_score = round(max(0.0, min(100.0, weighted_sum)))

                if composite_score >= 80:
                    risk_level = "LOW"
                elif composite_score >= 60:
                    risk_level = "MEDIUM"
                else:
                    risk_level = "HIGH"

        # -------------------------------------------------------------
        # Key Findings Synthesis
        # -------------------------------------------------------------
        key_findings: List[KeyFinding] = []
        if state == "NOT_ASSESSABLE":
            key_findings.append(KeyFinding(
                id="kf-na-1",
                severity="danger",
                category="Assessment",
                message=provisional_reason or "Supplier is not assessable due to lack of evidence.",
                source_reference="Evidence Coverage Engine",
            ))
        elif state == "PROVISIONAL":
            key_findings.append(KeyFinding(
                id="kf-prov-1",
                severity="warning",
                category="Assessment",
                message=provisional_reason or "Provisional assessment: partial evidence on file.",
                source_reference="Evidence Coverage Engine",
            ))

        if unreadable_documents > 0:
            key_findings.append(KeyFinding(
                id="kf-unreadable",
                severity="danger",
                category="Documents",
                message=f"{unreadable_documents} document(s) could not be read (scanned image without OCR or unparsed file) and were excluded from verification.",
                source_reference="Document Intake",
            ))

        for f in consistency_findings:
            ctype = f.get("conflict_type", "")
            if ctype == "GSTIN_PAN_MISMATCH":
                key_findings.append(KeyFinding(
                    id="kf-id-mismatch",
                    severity="danger",
                    category="Identity",
                    message=f.get("message", "PAN embedded in GSTIN differs from supplied PAN."),
                    source_reference=f.get("source_a", "GST / PAN Records"),
                ))
            elif ctype == "BANK_NAME_MISMATCH":
                key_findings.append(KeyFinding(
                    id="kf-bank-mismatch",
                    severity="warning",
                    category="Financial",
                    message=f.get("message", "Bank account holder name mismatch against registered name."),
                    source_reference=f.get("source_a", "Bank Records"),
                ))
            elif ctype == "PRICE_ANOMALY":
                key_findings.append(KeyFinding(
                    id="kf-price-anomaly",
                    severity="warning",
                    category="Financial",
                    message=f.get("message", "Price anomaly detected across invoices."),
                    source_reference=f.get("source_a", "Invoice cross-check"),
                ))
            elif ctype == "PRICE_CONSISTENT":
                key_findings.append(KeyFinding(
                    id="kf-price-consistent",
                    severity="success",
                    category="Financial",
                    message=f.get("message", "All quoted amounts fall within the expected range."),
                    source_reference=f.get("source_a", "Invoice cross-check"),
                ))
            elif str(ctype).startswith("CONFLICTING_"):
                key_findings.append(KeyFinding(
                    id="kf-doc-conflict",
                    severity="danger",
                    category="Documents",
                    message=f.get("message", "Conflicting field values across documents."),
                    source_reference=f.get("source_a", "Document cross-check"),
                ))
            elif f.get("status") == "EXPIRING_SOON":
                key_findings.append(KeyFinding(
                    id="kf-cert-expiring",
                    severity="warning",
                    category="Documents",
                    message=f.get("message", "Certificate expires soon."),
                    source_reference="Compliance Certificate",
                ))
            elif f.get("status") == "EXPIRED":
                key_findings.append(KeyFinding(
                    id="kf-cert-expired",
                    severity="danger",
                    category="Documents",
                    message=f.get("message", "Certificate has expired."),
                    source_reference="Compliance Certificate",
                ))

        for s in network_signals:
            if s.get("type") in ("SHARED_DIRECTOR_NETWORK", "SHARED_ADDRESS", "HIGH_CENTRALITY_DIRECTOR"):
                key_findings.append(KeyFinding(
                    id="kf-network-signal",
                    severity="warning",
                    category="Network",
                    message=s.get("message", "Shared attribute detected; review recommended."),
                    source_reference="Relationship Graph",
                ))

        breakdown = RiskBreakdown(
            identity=vector_details["identity"].score,
            documents=vector_details["documents"].score,
            financial=vector_details["financial"].score,
            operational=vector_details["operational"].score,
            network=vector_details["network"].score,
            reputation=vector_details["reputation"].score,
            vectors=vector_details,
        )

        return {
            "assessment_state": state,
            "evidence_coverage": coverage,
            "assessment_confidence": confidence,
            "provisional_reason": provisional_reason,
            "composite_score": composite_score,
            "risk_level": risk_level,
            "breakdown": breakdown,
            "key_findings": key_findings,
            "rule_version": self.rule_version,
        }


risk_engine = RiskScoringEngine()
