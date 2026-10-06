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

from app.services.validators import (
    validate_gstin,
    validate_pan,
    validate_cin,
    validate_ifsc,
    cross_check_gstin_pan,
)

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
    def check_gstin_pan_consistency(
        cls,
        gstin: Optional[str],
        pan: Optional[str],
        gstin_doc_info: Optional[Dict[str, Any]] = None,
        pan_doc_info: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        In India, characters 3-12 of a 15-character GSTIN represent the PAN of the entity.
        Cross-check validation with deterministic validator.
        """
        if not gstin or not pan:
            return None

        gstin_clean = gstin.strip().upper()
        pan_clean = pan.strip().upper()
        cross_res = cross_check_gstin_pan(gstin_clean, pan_clean)

        doc_a = gstin_doc_info or {}
        doc_b = pan_doc_info or {}

        source_a_details = {
            "document_id": doc_a.get("document_id"),
            "document_name": doc_a.get("document_name", "GST Document"),
            "page": doc_a.get("page_number", 1),
            "snippet": doc_a.get("snippet") or f"GSTIN: {gstin_clean}",
            "value": gstin_clean,
        }
        source_b_details = {
            "document_id": doc_b.get("document_id"),
            "document_name": doc_b.get("document_name", "PAN Document"),
            "page": doc_b.get("page_number", 1),
            "snippet": doc_b.get("snippet") or f"PAN: {pan_clean}",
            "value": pan_clean,
        }

        if not cross_res["passed"]:
            fail_reasons = ", ".join(cross_res["failed_rules"])
            return {
                "conflict_type": "GSTIN_PAN_MISMATCH",
                "severity": "danger",
                "message": f"Critical mismatch: PAN embedded in GSTIN contradicts provided PAN card ({fail_reasons}).",
                "source_a": f"GSTIN: {gstin_clean}",
                "source_b": f"PAN: {pan_clean}",
                "source_a_details": source_a_details,
                "source_b_details": source_b_details,
            }
        else:
            return {
                "conflict_type": "GSTIN_PAN_MATCH",
                "severity": "success",
                "message": f"Tax Identity verified: PAN ({pan_clean}) aligns with GSTIN ({gstin_clean}).",
                "source_a": f"GSTIN: {gstin_clean}",
                "source_b": f"PAN: {pan_clean}",
                "source_a_details": source_a_details,
                "source_b_details": source_b_details,
            }

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

    def check_entity_conflicts_across_documents(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        AC3 for user-uploaded documents: groups extracted entities by type across
        documents and flags contradictory values, citing both source documents.
        Each entity dict: {entity_type, entity_value, document_name, page_number}.
        """
        findings: List[Dict[str, Any]] = []
        by_type: Dict[str, List[Dict[str, Any]]] = {}
        for ent in entities:
            etype = ent.get("entity_type", "")
            if etype in {"GSTIN", "PAN", "BANK_ACCOUNT", "IFSC", "CIN", "LEGAL_NAME",
                         "ACCOUNT_HOLDER", "EXPIRY_DATE"}:
                by_type.setdefault(etype, []).append(ent)

        single_value_types = {
            "GSTIN": "GSTIN", "PAN": "PAN", "BANK_ACCOUNT": "bank account number",
            "IFSC": "IFSC code", "CIN": "CIN", "LEGAL_NAME": "legal name",
        }
        for etype, label in single_value_types.items():
            entries = by_type.get(etype, [])
            distinct = {}
            for ent in entries:
                distinct.setdefault(str(ent["entity_value"]).strip().upper(), ent)
            if len(distinct) > 1:
                values = list(distinct.values())
                doc_list = ", ".join(sorted({v.get("document_name", "?") for v in values}))
                findings.append({
                    "conflict_type": f"CONFLICTING_{etype}",
                    "severity": "danger",
                    "message": (
                        f"Conflicting {label} values across documents: "
                        f"{', '.join(sorted(distinct.keys()))} (sources: {doc_list})."
                    ),
                    "source_a": f"{values[0]['entity_value']} ({values[0].get('document_name', '?')}, p.{values[0].get('page_number', 1)})",
                    "source_b": f"{values[1]['entity_value']} ({values[1].get('document_name', '?')}, p.{values[1].get('page_number', 1)})",
                    "source_a_details": {
                        "document_id": values[0].get("document_id"),
                        "document_name": values[0].get("document_name", "?"),
                        "page": values[0].get("page_number", 1),
                        "snippet": values[0].get("snippet") or f"{etype}: {values[0]['entity_value']}",
                        "value": values[0]["entity_value"],
                    },
                    "source_b_details": {
                        "document_id": values[1].get("document_id"),
                        "document_name": values[1].get("document_name", "?"),
                        "page": values[1].get("page_number", 1),
                        "snippet": values[1].get("snippet") or f"{etype}: {values[1]['entity_value']}",
                        "value": values[1]["entity_value"],
                    },
                })

        # PAN embedded inside GSTIN (chars 3-12), across any document pair
        gstins = [e for e in by_type.get("GSTIN", [])]
        pans = [e for e in by_type.get("PAN", [])]
        if gstins and pans:
            gstin = str(gstins[0]["entity_value"]).strip().upper()
            if len(gstin) == 15:
                embedded = gstin[2:12]
                matching = [p for p in pans if str(p["entity_value"]).strip().upper() == embedded]
                if not matching:
                    pan = str(pans[0]["entity_value"]).strip().upper()
                    findings.append({
                        "conflict_type": "GSTIN_PAN_MISMATCH",
                        "severity": "danger",
                        "message": (
                            f"Critical mismatch: PAN embedded in GSTIN ({embedded}, from "
                            f"{gstins[0].get('document_name', '?')}) differs from PAN on record "
                            f"({pan}, from {pans[0].get('document_name', '?')})."
                        ),
                        "source_a": f"GSTIN: {gstin} ({gstins[0].get('document_name', '?')})",
                        "source_b": f"PAN: {pan} ({pans[0].get('document_name', '?')})",
                        "source_a_details": {
                            "document_id": gstins[0].get("document_id"),
                            "document_name": gstins[0].get("document_name", "?"),
                            "page": gstins[0].get("page_number", 1),
                            "snippet": gstins[0].get("snippet") or f"GSTIN: {gstin}",
                            "value": gstin,
                        },
                        "source_b_details": {
                            "document_id": pans[0].get("document_id"),
                            "document_name": pans[0].get("document_name", "?"),
                            "page": pans[0].get("page_number", 1),
                            "snippet": pans[0].get("snippet") or f"PAN: {pan}",
                            "value": pan,
                        },
                    })

        # Bank account holder vs registered legal name
        holders = by_type.get("ACCOUNT_HOLDER", [])
        legal_names = by_type.get("LEGAL_NAME", [])
        if holders:
            holder = str(holders[0]["entity_value"]).strip()
            legal = str(legal_names[0]["entity_value"]).strip() if legal_names else None
            if legal:
                sim = self.calculate_similarity(legal, holder)
                if sim < 0.85:
                    findings.append({
                        "conflict_type": "BANK_NAME_MISMATCH",
                        "severity": "warning" if sim >= 0.60 else "danger",
                        "message": (
                            f"Bank account is held under '{holder}' (per "
                            f"{holders[0].get('document_name', '?')}), which does not match the "
                            f"registered name '{legal}' (similarity {round(sim, 2)})."
                        ),
                        "similarity_score": round(sim, 2),
                        "source_a": f"Account holder: {holder} ({holders[0].get('document_name', '?')})",
                        "source_b": f"Legal name: {legal} ({legal_names[0].get('document_name', '?')})",
                        "source_a_details": {
                            "document_id": holders[0].get("document_id"),
                            "document_name": holders[0].get("document_name", "?"),
                            "page": holders[0].get("page_number", 1),
                            "snippet": holders[0].get("snippet") or f"Account Holder: {holder}",
                            "value": holder,
                        },
                        "source_b_details": {
                            "document_id": legal_names[0].get("document_id"),
                            "document_name": legal_names[0].get("document_name", "?"),
                            "page": legal_names[0].get("page_number", 1),
                            "snippet": legal_names[0].get("snippet") or f"Legal Name: {legal}",
                            "value": legal,
                        },
                    })

        return findings

    @staticmethod
    def _parse_amount(value: Any) -> Optional[float]:
        try:
            return float(str(value).replace(",", "").strip())
        except (TypeError, ValueError):
            return None

    def check_price_anomalies(self, entities: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Flags statistically outlying amounts across uploaded invoices/documents
        (IQR method, needs >= 4 amounts). Returns one financial finding with
        the offending document cited, or a success note when prices align.
        """
        amounts: List[Dict[str, Any]] = []
        for ent in entities:
            if ent.get("entity_type") != "AMOUNT":
                continue
            parsed = self._parse_amount(ent.get("entity_value", ""))
            if parsed and parsed > 0:
                amounts.append({**ent, "parsed": parsed})

        if len(amounts) < 4:
            return None

        values = sorted(a["parsed"] for a in amounts)
        n = len(values)

        def quartile(q: float) -> float:
            pos = q * (n - 1)
            low, high = int(pos), min(int(pos) + 1, n - 1)
            frac = pos - low
            return values[low] * (1 - frac) + values[high] * frac

        q1, q3 = quartile(0.25), quartile(0.75)
        iqr = q3 - q1
        if iqr <= 0:
            return None
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr

        outliers = [a for a in amounts if a["parsed"] < lower or a["parsed"] > upper]
        if not outliers:
            return {
                "conflict_type": "PRICE_CONSISTENT",
                "severity": "success",
                "message": (
                    f"All {n} quoted amounts fall within the expected range "
                    f"({values[0]:,.0f} - {values[-1]:,.0f})."
                ),
            }

        out = outliers[0]
        direction = "above" if out["parsed"] > upper else "below"
        return {
            "conflict_type": "PRICE_ANOMALY",
            "severity": "warning" if out["parsed"] < lower else "danger",
            "message": (
                f"Price anomaly: {out['parsed']:,.0f} quoted in \"{out.get('document_name', '?')}\" "
                f"is far {direction} the typical range "
                f"({max(lower, values[0]):,.0f} - {min(upper, values[-1]):,.0f}) across {n} amounts. "
                f"Verify for typos, hidden charges or fraudulent billing."
            ),
            "source_a": f"{out.get('document_name', '?')}: {out['parsed']:,.0f}",
            "source_b": f"Expected range from {n - 1} other document(s)",
        }

    def earliest_expiry_date(self, entities: List[Dict[str, Any]]) -> Optional[str]:
        """Returns the soonest EXPIRY_DATE entity value (most conservative view)."""
        parsed = []
        for ent in entities:
            if ent.get("entity_type") != "EXPIRY_DATE":
                continue
            value = str(ent.get("entity_value", "")).strip()
            for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d-%b-%Y"]:
                try:
                    parsed.append((datetime.strptime(value, fmt).date(), value))
                    break
                except ValueError:
                    continue
        if not parsed:
            return None
        parsed.sort()
        return parsed[0][1]

consistency_service = ConsistencyService()
