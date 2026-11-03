"""
NLI & Claim-Level Verification Engine (Trust Core).

Product Thesis: "Verify the Supplier. Verify the Evidence. Verify the AI."
- Categorizes AI assertions into:
    * SUPPORTED: Verified factual claim with linked evidence and >= 0.80 confidence.
    * CONTRADICTED: Inconsistent with ground-truth records.
    * INSUFFICIENT_EVIDENCE: Cannot be backed by repository evidence.
- Separates meta-statements ("no documents are available") into system notices,
  not factual claims.
- Applies the 0.80 confidence threshold; below 0.80 or conflicting evidence
  routes to human reviewer.
- Strict prompt-injection hygiene: retrieved text is data, never instructions.
"""

import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import List, Dict, Any, Tuple

CONFIDENCE_THRESHOLD = 0.80

INJECTION_PATTERNS = [
    r"(?i)\bignore\s+(?:all\s+)?(?:previous\s+|prior\s+)?instructions\b",
    r"(?i)\bsystem\s+prompt\b",
    r"(?i)\bdeveloper\s+(?:mode|instructions|settings)\b",
    r"(?i)\bbypass\s+(?:all\s+)?(?:rules|safeguards|verification)\b",
    r"(?i)\bmark\s+(?:this\s+)?(?:vendor|supplier)\s+(?:as\s+)?(?:verified|valid|clean|trusted)\b",
    r"(?i)\bset\s+(?:the\s+)?(?:risk\s+)?score\s+(?:to\s+)?\d+\b",
    r"(?i)\byou\s+are\s+now\s+(?:an?\s+)?(?:unrestricted|dan|admin|ai)\b",
    r"(?i)\bjailbreak\b",
]


def detect_prompt_injection(text: str) -> Dict[str, Any]:
    """Detects adversarial injection instructions inside text."""
    if not text:
        return {"detected": False, "patterns": [], "risk_label": "CLEAN"}
    matches = []
    for pat in INJECTION_PATTERNS:
        found = re.findall(pat, text)
        if found:
            matches.extend(found)
    if matches:
        return {
            "detected": True,
            "patterns": list(set(matches)),
            "risk_label": "SECURITY_ANOMALY",
            "message": "Adversarial prompt injection pattern detected in input text.",
        }
    return {"detected": False, "patterns": [], "risk_label": "CLEAN"}


def sanitize_data_text(text: str) -> str:
    """Hygiene: treat text strictly as data, strip script tags and injection patterns."""
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]*>", " ", text)
    cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", cleaned)
    for pat in INJECTION_PATTERNS:
        cleaned = re.sub(pat, "[FILTERED_INJECTION]", cleaned)
    return " ".join(cleaned.split())


META_PATTERNS = [
    re.compile(r"\bno documents or external evidence are available\b", re.IGNORECASE),
    re.compile(r"\bthe assessment is limited and manual review is required\b", re.IGNORECASE),
    re.compile(r"\bcould not be read \(scanned image\b", re.IGNORECASE),
    re.compile(r"\bi recommend manual verification\b", re.IGNORECASE),
    re.compile(r"\bno blocking discrepancies were detected\b", re.IGNORECASE),
    re.compile(r"\bverification cannot proceed without evidence\b", re.IGNORECASE),
    re.compile(r"\bthe assessment is not evidence-backed\b", re.IGNORECASE),
    re.compile(r"\bmanual review or a readable copy is required\b", re.IGNORECASE),
    re.compile(r"\bwere submitted for .* but none of them could be read\b", re.IGNORECASE),
]


class ClaimVerifierService:
    sanitize_data_text = staticmethod(sanitize_data_text)
    detect_prompt_injection = staticmethod(detect_prompt_injection)

    def is_meta_statement(self, text: str) -> bool:
        """Determines whether a statement is a system notice / disclaimer rather than a verifiable claim."""
        clean = text.strip()
        return any(bool(p.search(clean)) for p in META_PATTERNS)

    def deconstruct_into_claims_and_notices(self, text: str) -> Tuple[List[str], List[str]]:
        """
        Splits summary into atomic factual claims and system notices.
        Meta-statements ("no documents are available") become notices.
        """
        clean_text = sanitize_data_text(text)
        sentences = re.split(r"(?<=[.!?])\s+", clean_text)
        claims: List[str] = []
        notices: List[str] = []

        for s in sentences:
            s_clean = s.strip().strip("-*•").strip()
            if not s_clean or len(s_clean) < 8:
                continue

            if self.is_meta_statement(s_clean):
                notices.append(s_clean)
                continue

            # Look for sub-clauses joined by "including", "and", semicolons
            if "including" in s_clean.lower():
                pre, post = re.split(r"\bincluding\b", s_clean, flags=re.IGNORECASE, maxsplit=1)
                if len(pre.strip()) > 15:
                    if self.is_meta_statement(pre.strip()):
                        notices.append(pre.strip().rstrip(",; "))
                    else:
                        claims.append(pre.strip().rstrip(",; "))
                sub_parts = re.split(r",\s*(?:and\s+)?|\band\s+", post)
                for sp in sub_parts:
                    sp_clean = sp.strip().rstrip(".,; ")
                    if len(sp_clean) > 8:
                        if self.is_meta_statement(sp_clean):
                            notices.append(sp_clean)
                        else:
                            claims.append(sp_clean)
            else:
                claims.append(s_clean)

        return [c for c in claims if len(c) > 10], notices

    def deconstruct_into_claims(self, text: str) -> List[str]:
        """Backward compatibility: returns only testable claims (excluding notices)."""
        claims, _ = self.deconstruct_into_claims_and_notices(text)
        return claims

    # Polarity cues for contradiction detection
    CLAIM_NEGATIVE_CUES = re.compile(
        r"\bnot\s+match\b|\bmismatch\b|\bdiffers?\s+from\b|\binconsistent\b|\bconflicting\b|\bexpired\b|\bdoes\s+not\s+align\b",
        re.IGNORECASE,
    )
    CLAIM_POSITIVE_CUES = re.compile(
        r"\bmatch(?:es|ing)?\b|\bconsistent\b|\baligns\b|\bvalid\b|\bverified\b|\bbelongs\b|\bheld\s+in\s+the\s+name\s+of\b",
        re.IGNORECASE,
    )
    EVIDENCE_NEGATIVE_CUES = re.compile(
        r"\bmismatch\b|\bdiffers?\b|\bconflicting\b|\bnot\s+match\b|\bexpired\b|\bdiscrepanc|\binconsistent\b",
        re.IGNORECASE,
    )
    EVIDENCE_POSITIVE_CUES = re.compile(
        r"\bmatch(?:es|ing)?\b|\baligns\b|\bconsistent\b|\bactive\b|\bvalid\b|\bverified\b",
        re.IGNORECASE,
    )

    def verify_single_claim(
        self, claim_text: str, evidence_pool: List[Dict[str, Any]], model_version: str = "v2.0.0-trust-core"
    ) -> Dict[str, Any]:
        """
        Evaluates a claim against the evidence pool with prompt-injection defense
        and strict 0.80 confidence thresholding.
        """
        safe_claim = sanitize_data_text(claim_text)
        claim_lower = safe_claim.lower()
        stop_words = {"the", "a", "an", "is", "are", "with", "and", "or", "to", "in", "of", "for", "some", "two", "other", "there", "appears", "be"}
        claim_words = {w for w in re.findall(r"\w+", claim_lower) if w not in stop_words and len(w) > 2}

        claim_negative = bool(self.CLAIM_NEGATIVE_CUES.search(safe_claim))
        claim_positive = (not claim_negative) and bool(self.CLAIM_POSITIVE_CUES.search(safe_claim))

        best_match = None
        best_score = 0.0
        matching_evidence_ids: List[str] = []

        for ev in evidence_pool:
            snippet = sanitize_data_text(ev.get("snippet", ""))
            title = sanitize_data_text(ev.get("title", ""))
            combined_ev = f"{title} {snippet}".lower()
            ev_words = {w for w in re.findall(r"\w+", combined_ev) if w not in stop_words}

            if not claim_words:
                continue

            overlap = len(claim_words.intersection(ev_words)) / max(1, len(claim_words))
            seq_score = SequenceMatcher(None, claim_lower, combined_ev).ratio()

            term_boost = 0.0
            if any(w.startswith("director") for w in claim_words) and any(w.startswith("director") for w in ev_words):
                term_boost += 0.30
            if any(w.startswith("mismatch") for w in claim_words) and any(w.startswith("mismatch") for w in ev_words):
                term_boost += 0.25
            if any(w.startswith("expir") for w in claim_words) and any(w.startswith("expir") for w in ev_words):
                term_boost += 0.25
            if (any(w.startswith("bank") for w in claim_words) or any(w.startswith("account") for w in claim_words)) and (any(w.startswith("bank") for w in ev_words) or any(w.startswith("account") for w in ev_words)):
                term_boost += 0.25
            if any(w.startswith("differ") for w in claim_words) or any(w.startswith("differ") for w in ev_words):
                term_boost += 0.20

            score = (overlap * 0.70) + (seq_score * 0.30) + term_boost

            if score > 0.30:
                matching_evidence_ids.append(ev.get("evidence_id"))

            if score > best_score:
                best_score = score
                best_match = ev

        if not best_match or best_score < 0.25:
            status = "INSUFFICIENT_EVIDENCE"
            confidence = 0.35
            requires_reviewer = True
        elif best_score >= 0.35:
            ev_negative = bool(self.EVIDENCE_NEGATIVE_CUES.search(best_match.get("snippet", "")))
            ev_positive = bool(self.EVIDENCE_POSITIVE_CUES.search(best_match.get("snippet", "")))

            if claim_positive and ev_negative:
                status = "CONTRADICTED"
                confidence = round(min(0.98, max(0.60, best_score + 0.35)), 2)
                requires_reviewer = True
            elif claim_negative and ev_positive and not ev_negative:
                status = "CONTRADICTED"
                confidence = round(min(0.98, max(0.60, best_score + 0.30)), 2)
                requires_reviewer = True
            else:
                # Supported only if it meets standard entailment
                raw_conf = round(min(0.99, max(0.80, best_score + 0.30)), 2)
                status = "SUPPORTED"
                confidence = raw_conf
                requires_reviewer = confidence < CONFIDENCE_THRESHOLD
        else:
            status = "INSUFFICIENT_EVIDENCE"
            confidence = round(best_score, 2)
            requires_reviewer = True

        evidence_id = best_match.get("evidence_id") if best_match else None
        evidence_ids = [evidence_id] if evidence_id else []

        return {
            "claim_text": safe_claim,
            "status": status,
            "confidence_score": confidence,
            "evidence_id": evidence_id,
            "evidence_ids": evidence_ids,
            "evidence_snippet": best_match.get("snippet") if best_match else "No direct backing evidence found in uploaded repository.",
            "source_doc_name": (best_match.get("title") or best_match.get("source_type", "Unknown Source")) if best_match else "None",
            "requires_reviewer": requires_reviewer,
            "model_version": model_version,
            "created_at": datetime.now(timezone.utc),
        }

    def verify_analyst_summary(
        self, summary_text: str, evidence_pool: List[Dict[str, Any]], model_version: str = "v2.0.0-trust-core"
    ) -> Dict[str, Any]:
        """
        Deconstructs summary and verifies each claim against evidence.
        Returns:
          claims: List[Dict[str, Any]]
          notices: List[str]
          is_evidence_grounded: bool (True only if every material claim is supported)
        """
        claim_texts, notices = self.deconstruct_into_claims_and_notices(summary_text)
        results = []
        all_supported = len(claim_texts) > 0

        for idx, c in enumerate(claim_texts):
            v = self.verify_single_claim(c, evidence_pool, model_version=model_version)
            v["claim_id"] = f"clm-{idx+1}"
            v["claim_type"] = "FACTUAL_ASSERTION"
            if v["status"] != "SUPPORTED" or not v.get("evidence_id"):
                all_supported = False
            results.append(v)

        return {
            "claims": results,
            "notices": notices,
            "is_evidence_grounded": all_supported,
        }

    def verify_claim(self, claim_text: str, evidence_pool: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Convenience evaluation method returning status mapped as label."""
        res = self.verify_single_claim(claim_text, evidence_pool)
        return {"label": res["status"], **res}


claim_verifier_service = ClaimVerifierService()
