import pytest
from app.services.validators import (
    validate_gstin,
    validate_pan,
    validate_cin,
    validate_ifsc,
    cross_check_gstin_pan,
    generate_valid_gstin,
    calculate_gstin_checksum,
)


def test_gstin_rejects_sample_invalid():
    """
    Requirement 1.3:
    The sample '09ABCDE1234F125' must be rejected (14th char '2' != 'Z', checksum wrong, PAN entity code).
    """
    result = validate_gstin("09ABCDE1234F125")
    assert result["passed"] is False
    assert len(result["failed_rules"]) > 0
    # Must flag 14th char not Z and checksum
    assert any("14TH_CHAR_MUST_BE_Z" in r for r in result["failed_rules"])
    assert any("CHECKSUM" in r for r in result["failed_rules"])


def test_gstin_accepts_programmatically_generated_valid():
    """Valid GSTIN fixture generated with standard checksum must pass."""
    valid_pan = "AAACZ1234D"  # 'C' is Company
    valid_gstin = generate_valid_gstin(state_code="27", pan=valid_pan, entity_code="1")
    assert len(valid_gstin) == 15
    assert valid_gstin.startswith("27AAACZ1234D1Z")
    
    result = validate_gstin(valid_gstin)
    assert result["passed"] is True, f"Failed with rules: {result['failed_rules']}"
    assert result["failed_rules"] == []
    assert result["normalized_value"] == valid_gstin


def test_gstin_rejects_invalid_state_code():
    valid_pan = "AAACZ1234D"
    # State code 99 is invalid
    invalid_gst = "99" + valid_pan + "1Z"
    invalid_gst += calculate_gstin_checksum(invalid_gst)
    result = validate_gstin(invalid_gst)
    assert result["passed"] is False
    assert any("INVALID_STATE_CODE" in r for r in result["failed_rules"])


def test_gstin_rejects_wrong_checksum():
    valid_gstin = generate_valid_gstin(state_code="29", pan="AABCB1234E", entity_code="1")
    # Mutate checksum digit
    wrong_check = "0" if valid_gstin[-1] != "0" else "1"
    mutated = valid_gstin[:-1] + wrong_check
    result = validate_gstin(mutated)
    assert result["passed"] is False
    assert any("CHECKSUM_MISMATCH" in r for r in result["failed_rules"])


def test_gstin_rejects_wrong_length():
    result_short = validate_gstin("29AAACZ1234D1Z")
    assert result_short["passed"] is False
    assert any("INVALID_LENGTH" in r for r in result_short["failed_rules"])

    result_long = validate_gstin("29AAACZ1234D1Z299")
    assert result_long["passed"] is False


def test_pan_validation():
    # Valid Company PAN (4th char index 3 is 'C')
    valid_company_pan = "ABCCK1234C"
    res = validate_pan(valid_company_pan)
    assert res["passed"] is True, f"Failed: {res['failed_rules']}"

    # Valid Individual PAN (4th char index 3 is 'P')
    valid_ind_pan = "ABCPK1234F"
    assert validate_pan(valid_ind_pan)["passed"] is True

    # Invalid 4th char (e.g., 'X')
    invalid_pan = "ABCDX1234F"
    res_inv = validate_pan(invalid_pan)
    assert res_inv["passed"] is False
    assert any("INVALID_ENTITY_TYPE_CHAR" in r for r in res_inv["failed_rules"])

    # Invalid length
    assert validate_pan("ABCD1234")["passed"] is False


def test_cin_validation():
    # Standard 21-character CIN
    valid_cin = "U21014UP2017PTC098765"
    res = validate_cin(valid_cin)
    assert res["passed"] is True

    # Listed Company CIN
    valid_listed = "L17110MH1973PLC019786"
    assert validate_cin(valid_listed)["passed"] is True

    # Wrong structure
    assert validate_cin("X21014UP2017PTC098765")["passed"] is False
    assert validate_cin("U21014UP201PTC098765")["passed"] is False


def test_ifsc_validation():
    valid_ifsc = "HDFC0000128"
    assert validate_ifsc(valid_ifsc)["passed"] is True

    valid_sbi = "SBIN0001122"
    assert validate_ifsc(valid_sbi)["passed"] is True

    # 5th character must be '0'
    assert validate_ifsc("HDFC1000128")["passed"] is False
    # Length != 11
    assert validate_ifsc("HDFC00012")["passed"] is False


def test_cross_check_gstin_pan():
    pan = "AAACZ1234C"
    gstin = generate_valid_gstin(state_code="29", pan=pan, entity_code="1")
    
    # Matching
    match_res = cross_check_gstin_pan(gstin, pan)
    assert match_res["passed"] is True

    # Mismatching PAN
    diff_pan = "BBBCZ1234C"
    mismatch_res = cross_check_gstin_pan(gstin, diff_pan)
    assert mismatch_res["passed"] is False
    assert any("EMBEDDED_PAN_MISMATCH" in r for r in mismatch_res["failed_rules"])
