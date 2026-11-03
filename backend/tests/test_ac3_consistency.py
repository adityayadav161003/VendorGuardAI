from datetime import date, timedelta
from app.services.consistency import consistency_service

def test_ac3_bank_name_mismatch_flagged():
    """AC3: Flags bank account name mismatch and preserves both sources."""
    res = consistency_service.check_bank_name_consistency(
        legal_name="ABC Packaging Pvt Ltd",
        bank_account_name="ABC Pack Pvt Ltd"
    )
    assert res is not None
    assert res["conflict_type"] == "BANK_NAME_MISMATCH"
    assert res["severity"] == "warning"
    assert "source_a" in res
    assert "source_b" in res
    assert "ABC Packaging Pvt Ltd" in res["source_a"]
    assert "ABC Pack Pvt Ltd" in res["source_b"]

def test_ac3_gstin_pan_mismatch_flagged():
    """AC3: Flags mismatch when embedded PAN in GSTIN does not match provided PAN card."""
    res = consistency_service.check_gstin_pan_consistency(
        gstin="09ABCDE1234F125",
        pan="XYZPA9999K"  # Mismatch (should be ABCDE1234F)
    )
    assert res is not None
    assert res["conflict_type"] == "GSTIN_PAN_MISMATCH"
    assert res["severity"] == "danger"
    assert "source_a" in res
    assert "source_b" in res

def test_ac3_certificate_expiry_flagged():
    """AC3: Flags upcoming certificate expiration within 60 days."""
    expiring_soon_date = (date.today() + timedelta(days=47)).strftime("%d-%m-%Y")
    res = consistency_service.check_certificate_expiry(expiring_soon_date)
    assert res is not None
    assert res["status"] == "EXPIRING_SOON"
    assert res["severity"] == "warning"
    assert res["days_remaining"] == 47

# AC3 test suite
