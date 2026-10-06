"""
Deterministic Indian Regulatory Identifier Validators.
Pure functions executed prior to any AI or heuristics.

Specifications:
- GSTIN: 15 alphanumeric characters:
    * Chars 1-2: Valid 2-digit state code (01-38)
    * Chars 3-12: 10-char PAN (5 letters + 4 digits + 1 letter)
    * Char 13: Entity code (1-9, A-Z)
    * Char 14: Default 'Z'
    * Char 15: Standard Base-36 weighted checksum
- PAN: 10 characters (5 letters + 4 digits + 1 letter) with valid 4th char entity type.
- CIN: 21 characters (U/L + 5 digits + 2-letter state + 4-digit year + 3-letter type + 6 digits).
- IFSC: 11 characters (4 letters + '0' + 6 alphanumerics).
- Cross-check: PAN embedded in GSTIN must equal the supplied PAN.
"""

import re
from typing import Dict, List, Any, Optional

# Valid 2-digit Indian GST State Codes (01 to 38 + 97/99 for other territories)
VALID_GST_STATE_CODES = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "25": "Daman and Diu",
    "26": "Dadra and Nagar Haveli",
    "27": "Maharashtra",
    "28": "Andhra Pradesh (Old)",
    "29": "Karnataka",
    "30": "Goa",
    "31": "Lakshadweep",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "35": "Andaman and Nicobar Islands",
    "36": "Telangana",
    "37": "Andhra Pradesh (New)",
    "38": "Ladakh",
    "97": "Other Territory",
}

# 4th character of PAN indicates entity status
VALID_PAN_ENTITY_TYPES = {
    "C": "Company",
    "P": "Person / Individual",
    "H": "Hindu Undivided Family (HUF)",
    "F": "Firm / Limited Liability Partnership",
    "A": "Association of Persons (AOP)",
    "T": "Trust",
    "B": "Body of Individuals (BOI)",
    "L": "Local Authority",
    "J": "Artificial Juridical Person",
    "G": "Government Agency",
}

# Base-36 characters for GSTIN checksum
BASE36_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE36_MAP = {c: i for i, c in enumerate(BASE36_CHARS)}


def calculate_gstin_checksum(gstin14: str) -> str:
    """Calculates the 15th character base-36 checksum for a 14-character GSTIN prefix."""
    factor = 1
    total = 0
    for char in gstin14.upper():
        val = BASE36_MAP[char]
        prod = val * factor
        quot, rem = divmod(prod, 36)
        total += quot + rem
        factor = 2 if factor == 1 else 1

    rem = total % 36
    check_code = (36 - rem) % 36
    return BASE36_CHARS[check_code]


def generate_valid_gstin(
    state_code: str = "27",
    pan: str = "AAACZ1234D",
    entity_code: str = "1"
) -> str:
    """Programmatically generates a structurally and checksum-valid GSTIN fixture."""
    clean_state = str(state_code).zfill(2)
    clean_pan = pan.strip().upper()
    clean_entity = str(entity_code).strip().upper()
    prefix14 = f"{clean_state}{clean_pan}{clean_entity}Z"
    checksum = calculate_gstin_checksum(prefix14)
    return f"{prefix14}{checksum}"


def validate_gstin(raw_value: Optional[str]) -> Dict[str, Any]:
    """
    Validates a GSTIN string against all statutory rules.
    Returns: { passed: bool, failed_rules: List[str], normalized_value: Optional[str] }
    """
    if not raw_value or not isinstance(raw_value, str):
        return {
            "passed": False,
            "failed_rules": ["GSTIN_EMPTY_OR_NON_STRING"],
            "normalized_value": None,
        }

    norm = re.sub(r"\s+", "", raw_value).upper()
    failed_rules: List[str] = []

    # Rule 1: Length check
    if len(norm) != 15:
        failed_rules.append(f"GSTIN_INVALID_LENGTH_{len(norm)}_EXPECTED_15")
        return {
            "passed": False,
            "failed_rules": failed_rules,
            "normalized_value": norm,
        }

    # Rule 2: Basic alphanumeric pattern
    if not re.match(r"^[0-9A-Z]{15}$", norm):
        failed_rules.append("GSTIN_NON_ALPHANUMERIC_CHARACTERS")

    # Rule 3: Valid state code (chars 0-1)
    state_code = norm[:2]
    if state_code not in VALID_GST_STATE_CODES:
        failed_rules.append(f"GSTIN_INVALID_STATE_CODE_{state_code}")

    # Rule 4: Embedded PAN structure (chars 2-11)
    embedded_pan = norm[2:12]
    pan_validation = validate_pan(embedded_pan)
    if not pan_validation["passed"]:
        for rule in pan_validation["failed_rules"]:
            failed_rules.append(f"GSTIN_EMBEDDED_{rule}")

    # Rule 5: Entity code (char 12)
    entity_char = norm[12]
    if not re.match(r"^[1-9A-Z]$", entity_char):
        failed_rules.append(f"GSTIN_INVALID_ENTITY_CHAR_{entity_char}")

    # Rule 6: 14th character must be 'Z'
    fourteenth_char = norm[13]
    if fourteenth_char != "Z":
        failed_rules.append(f"GSTIN_14TH_CHAR_MUST_BE_Z_FOUND_{fourteenth_char}")

    # Rule 7: 15th character Base-36 checksum
    try:
        expected_check = calculate_gstin_checksum(norm[:14])
        actual_check = norm[14]
        if actual_check != expected_check:
            failed_rules.append(
                f"GSTIN_CHECKSUM_MISMATCH_EXPECTED_{expected_check}_FOUND_{actual_check}"
            )
    except KeyError as exc:
        failed_rules.append(f"GSTIN_CHECKSUM_CALC_FAILED_{exc}")

    return {
        "passed": len(failed_rules) == 0,
        "failed_rules": failed_rules,
        "normalized_value": norm,
    }


def validate_pan(raw_value: Optional[str]) -> Dict[str, Any]:
    """
    Validates a Permanent Account Number (PAN).
    Structure: 5 letters + 4 digits + 1 letter.
    4th character is entity type letter (C, P, H, F, A, T, B, L, J, G).
    """
    if not raw_value or not isinstance(raw_value, str):
        return {
            "passed": False,
            "failed_rules": ["PAN_EMPTY_OR_NON_STRING"],
            "normalized_value": None,
        }

    norm = re.sub(r"\s+", "", raw_value).upper()
    failed_rules: List[str] = []

    if len(norm) != 10:
        failed_rules.append(f"PAN_INVALID_LENGTH_{len(norm)}_EXPECTED_10")
        return {
            "passed": False,
            "failed_rules": failed_rules,
            "normalized_value": norm,
        }

    if not re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", norm):
        failed_rules.append("PAN_INVALID_FORMAT_PATTERN")

    entity_char = norm[3] if len(norm) >= 4 else ""
    if entity_char not in VALID_PAN_ENTITY_TYPES:
        failed_rules.append(f"PAN_INVALID_ENTITY_TYPE_CHAR_{entity_char}")

    return {
        "passed": len(failed_rules) == 0,
        "failed_rules": failed_rules,
        "normalized_value": norm,
    }


def validate_cin(raw_value: Optional[str]) -> Dict[str, Any]:
    """
    Validates a 21-character Corporate Identification Number (CIN).
    Pattern: [UL]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}
    """
    if not raw_value or not isinstance(raw_value, str):
        return {
            "passed": False,
            "failed_rules": ["CIN_EMPTY_OR_NON_STRING"],
            "normalized_value": None,
        }

    norm = re.sub(r"\s+", "", raw_value).upper()
    failed_rules: List[str] = []

    if len(norm) != 21:
        failed_rules.append(f"CIN_INVALID_LENGTH_{len(norm)}_EXPECTED_21")
        return {
            "passed": False,
            "failed_rules": failed_rules,
            "normalized_value": norm,
        }

    if not re.match(r"^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$", norm):
        failed_rules.append("CIN_INVALID_STRUCTURE")

    return {
        "passed": len(failed_rules) == 0,
        "failed_rules": failed_rules,
        "normalized_value": norm,
    }


def validate_ifsc(raw_value: Optional[str]) -> Dict[str, Any]:
    """
    Validates an 11-character Indian Financial System Code (IFSC).
    Pattern: 4 alphabetic characters + '0' + 6 alphanumeric characters.
    """
    if not raw_value or not isinstance(raw_value, str):
        return {
            "passed": False,
            "failed_rules": ["IFSC_EMPTY_OR_NON_STRING"],
            "normalized_value": None,
        }

    norm = re.sub(r"\s+", "", raw_value).upper()
    failed_rules: List[str] = []

    if len(norm) != 11:
        failed_rules.append(f"IFSC_INVALID_LENGTH_{len(norm)}_EXPECTED_11")
        return {
            "passed": False,
            "failed_rules": failed_rules,
            "normalized_value": norm,
        }

    if not re.match(r"^[A-Z]{4}0[0-9A-Z]{6}$", norm):
        failed_rules.append("IFSC_INVALID_STRUCTURE")

    return {
        "passed": len(failed_rules) == 0,
        "failed_rules": failed_rules,
        "normalized_value": norm,
    }


def cross_check_gstin_pan(gstin: Optional[str], pan: Optional[str]) -> Dict[str, Any]:
    """
    Cross-checks that the PAN embedded within the GSTIN strictly equals the provided PAN.
    Both must be format-valid, and the PAN substring (chars 3 to 12) must match.
    """
    gst_res = validate_gstin(gstin)
    pan_res = validate_pan(pan)

    failed_rules: List[str] = []
    if not gst_res["passed"]:
        failed_rules.extend([f"GSTIN_{r}" for r in gst_res["failed_rules"]])
    if not pan_res["passed"]:
        failed_rules.extend([f"PAN_{r}" for r in pan_res["failed_rules"]])

    if gst_res["normalized_value"] and pan_res["normalized_value"]:
        embedded = gst_res["normalized_value"][2:12]
        provided = pan_res["normalized_value"]
        if embedded != provided:
            failed_rules.append(f"EMBEDDED_PAN_MISMATCH_{embedded}_VS_{provided}")

    return {
        "passed": len(failed_rules) == 0,
        "failed_rules": failed_rules,
        "normalized_gstin": gst_res["normalized_value"],
        "normalized_pan": pan_res["normalized_value"],
    }
