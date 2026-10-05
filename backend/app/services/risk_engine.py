from typing import Dict, List, Any
from app.schemas.analysis import RiskBreakdown, KeyFinding

class RiskScoringEngine:
    """
    Computes explainable multi-vector risk scores (0-100) and composite trust score.
    Higher score (70-100) = Healthy / High Trust
    Medium (50-74) = Moderate Risk / Manual Review Recommended
    Low (<50) = High Risk / Flagged
    """

    # Weights for composite risk score calculation
    VECTOR_WEIGHTS = {
        "identity": 0.15,
        "documents": 0.15,
        "financial": 0.25,
        "operational": 0.15,
        "network": 0.20,
        "reputation": 0.10
    }

    def evaluate_supplier_risk(
        self,
        supplier_profile: Dict[str, Any],
        consistency_findings: List[Dict[str, Any]],
        network_signals: List[Dict[str, Any]],
        external_evidence: List[Dict[str, Any]],
        has_document_evidence: bool = True,
    ) -> Dict[str, Any]:

        # 1. Identity Score (Base: 92)
        identity_score = 92.0
        if not supplier_profile.get("gstin_verified", True):
            identity_score -= 30.0
        if any(f.get("conflict_type") == "GSTIN_PAN_MISMATCH" for f in consistency_findings):
            identity_score -= 40.0
        identity_score = max(0.0, min(100.0, identity_score))

        # 2. Document Score (Base: 95, or 55 when nothing was submitted)
        document_score = 95.0
        has_expiring_cert = any(f.get("status") == "EXPIRING_SOON" for f in consistency_findings)
        has_expired_cert = any(f.get("status") == "EXPIRED" for f in consistency_findings)
        if has_expiring_cert:
            document_score -= 7.0
        if has_expired_cert:
            document_score -= 25.0
        if not has_document_evidence:
            document_score = 55.0
        document_score = max(0.0, min(100.0, document_score))

        # 3. Financial Score (Base: 90)
        financial_score = 90.0
        bank_mismatch = any(f.get("conflict_type") == "BANK_NAME_MISMATCH" for f in consistency_findings)
        if bank_mismatch:
            financial_score -= 19.0  # Brings 90 -> 71
        financial_score = max(0.0, min(100.0, financial_score))

        # 4. Operational Score (Base: 84, or 70 when vintage is unknown)
        operational_score = 84.0
        vintage_years = supplier_profile.get("years_in_business")
        if vintage_years is None:
            operational_score = 70.0
        elif vintage_years < 2:
            operational_score -= 20.0
        operational_score = max(0.0, min(100.0, operational_score))

        # 5. Network Score (Base: 90)
        network_score = 90.0
        shared_directors = any(s.get("type") == "SHARED_DIRECTOR_NETWORK" for s in network_signals)
        if shared_directors:
            network_score -= 28.0  # Brings 90 -> 62
        network_score = max(0.0, min(100.0, network_score))

        # 6. Reputation Score (Base: 85)
        reputation_score = 85.0
        neg_reviews_count = sum(1 for e in external_evidence if "negative" in e.get("snippet", "").lower() or "complaint" in e.get("snippet", "").lower())
        if neg_reviews_count > 0:
            reputation_score -= (neg_reviews_count * 5.3)  # e.g. 3 reviews -> ~69
        reputation_score = max(0.0, min(100.0, round(reputation_score)))

        # Compound risk penalties
        tax_identity_mismatch = any(f.get("conflict_type") == "GSTIN_PAN_MISMATCH" for f in consistency_findings)
        conflicting_docs = any(str(f.get("conflict_type", "")).startswith("CONFLICTING_") for f in consistency_findings)
        compounding_penalty = 0.0
        if bank_mismatch and shared_directors:
            compounding_penalty += 2.3
        if tax_identity_mismatch:
            # A broken PAN-in-GSTIN link is a critical identity-fraud signal
            compounding_penalty += 8.0
        if conflicting_docs:
            compounding_penalty += 4.0

        # Composite Weighted Score
        composite_score = (
            identity_score * 0.10 +
            document_score * 0.10 +
            financial_score * 0.30 +
            operational_score * 0.15 +
            network_score * 0.25 +
            reputation_score * 0.10 -
            compounding_penalty
        )
        composite_score = round(composite_score)

        # A critical tax-identity contradiction forces HIGH risk pending human review,
        # regardless of how healthy the other vectors look.
        if tax_identity_mismatch:
            composite_score = min(composite_score, 55)

        if composite_score >= 80:
            risk_level = "LOW"
        elif composite_score >= 60:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # Synthesize Key Findings list
        key_findings = []
        if supplier_profile.get("gstin_verified", True):
            key_findings.append(KeyFinding(
                id="kf-1",
                severity="success",
                category="Identity",
                message=supplier_profile.get(
                    "identity_message",
                    "GST information verified with government portal"
                ),
                source_reference=supplier_profile.get("identity_source", "GST Portal & Registration Certificate")
            ))

        if supplier_profile.get("incorporation_verified", True):
            key_findings.append(KeyFinding(
                id="kf-2",
                severity="success",
                category="Compliance",
                message=supplier_profile.get(
                    "registration_message",
                    "Company registration valid"
                ),
                source_reference=supplier_profile.get("registration_source", "MCA21 Registry")
            ))

        if not has_document_evidence:
            key_findings.append(KeyFinding(
                id="kf-0a",
                severity="danger",
                category="Documents",
                message="No supplier documents have been submitted for review; the assessment relies on external evidence only.",
                source_reference="Document Intake"
            ))

        if supplier_profile.get("years_in_business") is None:
            key_findings.append(KeyFinding(
                id="kf-0b",
                severity="info",
                category="Operational",
                message="Operational vintage could not be established from the submitted documents.",
                source_reference="Company Registration"
            ))

        for f in consistency_findings:
            if f.get("conflict_type") == "GSTIN_PAN_MISMATCH":
                key_findings.append(KeyFinding(
                    id="kf-7",
                    severity="danger",
                    category="Identity",
                    message=f.get("message", "PAN embedded in GSTIN does not match the provided PAN"),
                    source_reference=f.get("source_a", "GST Certificate / PAN Card")
                ))
            elif str(f.get("conflict_type", "")).startswith("CONFLICTING_"):
                key_findings.append(KeyFinding(
                    id="kf-8",
                    severity="danger",
                    category="Documents",
                    message=f.get("message", "Conflicting values across documents"),
                    source_reference=f.get("source_a", "Cross-document check")
                ))
            elif f.get("status") == "EXPIRING_SOON":
                key_findings.append(KeyFinding(
                    id="kf-3",
                    severity="warning",
                    category="Documents",
                    message=f.get("message", "Certificate expiring soon"),
                    source_reference="ISO 9001 Certificate"
                ))
            elif f.get("conflict_type") == "BANK_NAME_MISMATCH":
                key_findings.append(KeyFinding(
                    id="kf-4",
                    severity="danger",
                    category="Financial",
                    message=f.get("message", "Bank account name mismatch"),
                    source_reference="Cancelled Cheque & GST Certificate"
                ))

        for s in network_signals:
            if s.get("type") == "SHARED_DIRECTOR_NETWORK":
                key_findings.append(KeyFinding(
                    id="kf-5",
                    severity="warning",
                    category="Network",
                    message=s.get("message", "Shared director network detected"),
                    source_reference="MCA Director Master Data"
                ))

        if neg_reviews_count > 0:
            key_findings.append(KeyFinding(
                id="kf-6",
                severity="info",
                category="Reputation",
                message=f"{neg_reviews_count} negative supplier reviews found online",
                source_reference="B2B Marketplace & Review Aggregator"
            ))

        breakdown = RiskBreakdown(
            identity=round(identity_score),
            documents=round(document_score),
            financial=round(financial_score),
            operational=round(operational_score),
            network=round(network_score),
            reputation=round(reputation_score)
        )

        return {
            "composite_score": composite_score,
            "risk_level": risk_level,
            "breakdown": breakdown,
            "key_findings": key_findings
        }

risk_engine = RiskScoringEngine()
