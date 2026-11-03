import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher

STATE_CODES = {
    "01": "Jammu & Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "19": "West Bengal",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "33": "Tamil Nadu",
    "36": "Telangana"
}

class ConsistencyService:
    @staticmethod
    def normalize_name(name: str) -> str:
        """
        Normalizes company names for fuzzy entity comparison.
        E.g. 'ABC Packaging Pvt Ltd' -> 'abc packaging'
        """
        if not name:
            return ""
        s = name.lower()
        # Remove common corporate designators
        patterns = [
            r"\bpvt\.?\s*ltd\.?\b",
            r"\bprivate\s+limited\b",
            r"\blimited\b",
            r"\bllp\b",
            r"\binc\.?\b",
            r"\bcorp\.?\b",
            r"\bm/s\.?\b",
            r"\bco\.?\b"
        ]
        for p in patterns:
            s = re.sub(p, "", s)
        # Remove non-alphanumeric characters
        s = re.sub(r"[^a-z0-9\s]", " ", s)
        return " ".join(s.split())

    @classmethod
    def calculate_similarity(cls, str1: str, str2: str) -> float:
        norm1 = cls.normalize_name(str1)
        norm2 = cls.normalize_name(str2)
        if not norm1 or not norm2:
            return 0.0
        return SequenceMatcher(None, norm1, norm2).ratio()

    @classmethod
    def check_gstin_pan_consistency(cls, gstin: Optional[str], pan: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        In India, characters 3-12 of a 15-character GSTIN represent the PAN of the entity.
        AC3: Known cross-document conflicts flagged with both sources.
        """
        if not gstin or not pan:
            return None

        gstin_clean = gstin.strip().upper()
        pan_clean = pan.strip().upper()

        if len(gstin_clean) == 15:
            embedded_pan = gstin_clean[2:12]
            if embedded_pan != pan_clean:
                return {
                    "conflict_type": "GSTIN_PAN_MISMATCH",
                    "severity": "danger",
                    "message": f"Critical mismatch: PAN embedded in GSTIN ({embedded_pan}) differs from provided PAN Card ({pan_clean}).",
                    "source_a": f"GSTIN: {gstin_clean}",
                    "source_b": f"PAN: {pan_clean}"
                }
            else:
                return {
                    "conflict_type": "GSTIN_PAN_MATCH",
                    "severity": "success",
                    "message": f"Tax Identity verified: PAN ({pan_clean}) aligns with GSTIN ({gstin_clean}).",
                    "source_a": f"GSTIN: {gstin_clean}",
                    "source_b": f"PAN: {pan_clean}"
                }
        return None

    @classmethod
    def check_bank_name_consistency(cls, legal_name: str, bank_account_name: str) -> Optional[Dict[str, Any]]:
        """
        Checks if bank account holder name matches registered legal company name.
        """
        if not legal_name or not bank_account_name:
            return None

        sim = cls.calculate_similarity(legal_name, bank_account_name)
        if sim < 0.85:
            return {
                "conflict_type": "BANK_NAME_MISMATCH",
                "severity": "warning" if sim >= 0.60 else "danger",
                "message": f"Bank account name mismatch ({bank_account_name} vs {legal_name})",
                "similarity_score": round(sim, 2),
                "source_a": f"Legal Name: {legal_name}",
                "source_b": f"Bank Name: {bank_account_name}"
            }
        return {
            "conflict_type": "BANK_NAME_MATCH",
            "severity": "success",
            "message": f"Bank account holder name matches registered legal name ({legal_name}).",
            "similarity_score": round(sim, 2)
        }

    @staticmethod
    def check_certificate_expiry(expiry_date_str: str, current_date: Optional[date] = None) -> Optional[Dict[str, Any]]:
        """
        Parses certificate expiration date and flags upcoming expirations (< 60 days).
        """
        if not expiry_date_str:
            return None

        ref_date = current_date or date.today()
        # Try various date formats
        parsed_date = None
        for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d-%b-%Y"]:
            try:
                parsed_date = datetime.strptime(expiry_date_str.strip(), fmt).date()
                break
            except ValueError:
                continue

        if not parsed_date:
            return None

        delta_days = (parsed_date - ref_date).days
        if delta_days < 0:
            return {
                "status": "EXPIRED",
                "severity": "danger",
                "days_remaining": delta_days,
                "message": f"Certificate expired {abs(delta_days)} days ago on {parsed_date.isoformat()}."
            }
        elif delta_days <= 60:
            return {
                "status": "EXPIRING_SOON",
                "severity": "warning",
                "days_remaining": delta_days,
                "message": f"ISO / Compliance certificate expires in {delta_days} days on {parsed_date.isoformat()}."
            }
        else:
            return {
                "status": "VALID",
                "severity": "success",
                "days_remaining": delta_days,
                "message": f"Certificate valid until {parsed_date.isoformat()} ({delta_days} days remaining)."
            }

consistency_service = ConsistencyService()

# Corporate suffix cleaning
# Fuzzy matching
# GSTIN PAN alignment
# Bank mismatch logic
# Expiry delta check
# State code dictionary
# Empty string handling
