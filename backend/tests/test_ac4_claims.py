from app.services.claim_verifier import claim_verifier_service

def test_ac4_claim_verification_labels_and_links():
    """AC4: AI claims are labeled supported, contradicted or insufficient evidence with evidence links."""
    evidence_pool = [
        {
            "evidence_id": "ev-gst-1",
            "title": "GST Registration Certificate",
            "snippet": "GSTIN 09ABCDE1234F125 registered to ABC Packaging Pvt Ltd. Verified Active.",
            "source_type": "GST Portal"
        },
        {
            "evidence_id": "ev-bank-1",
            "title": "Cancelled Cheque",
            "snippet": "Bank account name mismatch between ABC Packaging and ABC Pack Pvt Ltd.",
            "source_type": "Bank Document"
        }
    ]

    # 1. Test Supported Claim
    claim_supported = "ABC Packaging Pvt Ltd has valid GST registration"
    res1 = claim_verifier_service.verify_single_claim(claim_supported, evidence_pool)
    assert res1["status"] == "SUPPORTED"
    assert res1["evidence_id"] == "ev-gst-1"
    assert res1["confidence_score"] >= 0.70

    # 2. Test Insufficient Evidence Claim (No relevant evidence)
    claim_unknown = "The supplier operates a subsidiary office in Berlin Germany"
    res2 = claim_verifier_service.verify_single_claim(claim_unknown, evidence_pool)
    assert res2["status"] in ["INSUFFICIENT_EVIDENCE", "CONTRADICTED"]
    assert res2["confidence_score"] < 0.70

# AC4 test suite
