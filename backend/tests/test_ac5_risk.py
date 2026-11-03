from app.services.risk_engine import risk_engine

def test_ac5_risk_score_and_breakdown():
    """AC5: Reports show risk indicators, explanations, evidence and limitations."""
    supplier_profile = {
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
        external_evidence=external_evidence
    )

    # Validate composite score matching poster benchmark
    assert eval_result["composite_score"] == 72
    assert eval_result["risk_level"] == "MEDIUM"

    breakdown = eval_result["breakdown"]
    assert breakdown.identity == 92.0
    assert breakdown.documents == 88.0
    assert breakdown.financial == 71.0
    assert breakdown.operational == 84.0
    assert breakdown.network == 62.0
    assert breakdown.reputation == 69.0

    # Ensure key findings list has categorized explanations
    assert len(eval_result["key_findings"]) >= 5
    for kf in eval_result["key_findings"]:
        assert kf.category in ["Identity", "Compliance", "Documents", "Financial", "Network", "Reputation"]
        assert kf.severity in ["success", "warning", "danger", "info"]

# AC5 test suite
