from app.services.document_ai import document_ai_service

def test_ac2_field_provenance_and_confidence():
    """AC2: Extracted fields show source page/snippet and confidence where available."""
    mock_pages = [
        {
            "page": 1,
            "text": "Certificate of Registration\nLegal Name: ABC Packaging Pvt Ltd\nGSTIN: 09ABCDE1234F125\nPAN: ABCDE1234F"
        },
        {
            "page": 2,
            "text": "Bank Details:\nA/C Number: 987654321012\nIFSC: HDFC0000128\nDirector: Rajesh Kumar"
        }
    ]

    extracted = document_ai_service.extract_entities_with_provenance(mock_pages)
    assert len(extracted) >= 4

    # Verify that every entity carries confidence, page_number, and snippet provenance
    for ent in extracted:
        assert "entity_type" in ent
        assert "entity_value" in ent
        assert "confidence_score" in ent
        assert 0.0 <= ent["confidence_score"] <= 1.0
        assert "page_number" in ent
        assert ent["page_number"] in [1, 2]
        assert "snippet" in ent
        assert len(ent["snippet"]) > 5

    # Check specific fields
    gstin_ent = next(e for e in extracted if e["entity_type"] == "GSTIN")
    assert gstin_ent["entity_value"] == "09ABCDE1234F125"
    assert gstin_ent["page_number"] == 1

    bank_ent = next(e for e in extracted if e["entity_type"] == "BANK_ACCOUNT")
    assert bank_ent["entity_value"] == "987654321012"
    assert bank_ent["page_number"] == 2

# AC2 test suite
