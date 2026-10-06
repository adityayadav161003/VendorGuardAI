from app.services.risk_engine import risk_engine

def test_ac5_risk_score_and_breakdown():
    """AC5: Reports show risk indicators, explanations, evidence and limitations."""
    supplier_profile = {
        "gstin": "07AAAAA0000A1Z5",
        "pan": "AAAAA0000A",
        "gstin_verified": True,
        "incorporation_verified": True,
        "years_in_business": 7
    }
    consistency_findings = [
        {"status": "EXPIRING_SOON", "message": "ISO certificate expires in 47 days"},
        {"conflict_type": "BANK_NAME_MISMATCH", "message": "Bank account name mismatch"}
    ]
    network_signals = [
        {"type": "SHARED_DIRECTOR_NETWORK", "message": "2 related companies share same director"}
    ]
    external_evidence = [
        {"snippet": "negative review 1"},
        {"snippet": "negative review 2"},
        {"snippet": "negative complaint 3"}
    ]

    eval_result = risk_engine.evaluate_supplier_risk(
        supplier_profile=supplier_profile,
        consistency_findings=consistency_findings,
        network_signals=network_signals,
        external_evidence=external_evidence,
        total_documents=4,
        extracted_entities=[
            {"entity_type": "GSTIN"},
            {"entity_type": "PAN"},
            {"entity_type": "BANK_ACCOUNT"},
            {"entity_type": "EXPIRY_DATE"},
        ],
        data_source="GOVERNMENT_PORTAL",
    )

    # Validate state machine and dynamic multi-vector breakdown
    assert eval_result["assessment_state"] in ["PROVISIONAL", "ASSESSED"]
    assert eval_result["evidence_coverage"] >= 30.0
    assert eval_result["assessment_confidence"] > 0.0
    assert eval_result["composite_score"] is not None
    assert eval_result["risk_level"] in ["LOW", "MEDIUM", "HIGH"]

    breakdown = eval_result["breakdown"]
    # Dynamic vectors starting at 100 minus penalties
    assert breakdown.identity is not None and breakdown.identity <= 100.0
    assert breakdown.documents is not None and breakdown.documents == 90.0  # 100 - 10 expiring soon
    assert breakdown.network is not None and breakdown.network == 80.0  # 100 - 20 shared director
    assert breakdown.reputation is not None and breakdown.reputation <= 100.0

    # Ensure rich vector maps exist and adhere to schema
    assert "identity" in breakdown.vectors
    assert breakdown.vectors["identity"].rule_version == "v2.0.0-trust-core"

    # Ensure key findings list has categorized explanations
    assert len(eval_result["key_findings"]) >= 3
    for kf in eval_result["key_findings"]:
        assert kf.category in ["Identity", "Compliance", "Documents", "Financial", "Network", "Reputation", "Assessment"]
        assert kf.severity in ["success", "warning", "danger", "info"]

# AC5 test suite
