import re
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

# Standard Regex patterns for Indian B2B Supplier Verification
PATTERNS = {
    "GSTIN": r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{2,3})\b",
    "PAN": r"\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b",
    "CIN": r"\b([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})\b",
    "IFSC": r"\b([A-Z]{4}0[A-Z0-9]{6})\b",
    "BANK_ACCOUNT": r"\b([0-9]{9,18})\b",
    "EXPIRY_DATE": r"(?:expires?|valid(?:ity)?(?:\s+till|\s+upto)?|expiry\s+date)[\s:]*([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})",
    "DATE": r"\b([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4}|[0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})\b",
    "ACCOUNT_HOLDER": r"(?:account\s+holder|under\s+name|held\s+by|in\s+the\s+name\s+of|operated\s+by)[\s:]*[\"']?([A-Za-z][A-Za-z0-9&.,'\- ]{2,60}?)[\"']?\s*(?:,|\.|$|\n)",
    "INCORPORATION_YEAR": r"(?:incorporated|registered|established|incorporation\s+date)[^.\n]{0,40}?\b(19[89]\d|20[0-2]\d)\b",
}

class DocumentAIService:
    @staticmethod
    def compute_sha256(file_path: Path) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                sha256.update(block)
        return sha256.hexdigest()

    @staticmethod
    def extract_text_from_file(file_path: Path) -> List[Dict[str, Any]]:
        """
        Extracts text page by page.
        Returns a list of dicts: [{"page": 1, "text": "..."}]
        """
        pages_content = []
        ext = file_path.suffix.lower()

        if ext == ".pdf" and HAS_PYPDF:
            try:
                reader = PdfReader(str(file_path))
                for idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    pages_content.append({"page": idx + 1, "text": text.strip()})
            except Exception as e:
                pages_content.append({"page": 1, "text": f"[Error reading PDF: {e}]"})
        elif ext in [".txt", ".json", ".csv"]:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    pages_content.append({"page": 1, "text": f.read().strip()})
            except Exception as e:
                pages_content.append({"page": 1, "text": f"[Error reading text file: {e}]"})
        else:
            # Fallback for mock/binary/unsupported formats
            pages_content.append({"page": 1, "text": ""})

        return pages_content

    @staticmethod
    def extract_entities_with_provenance(pages_content: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Extracts structured entities with provenance (AC2: page number + snippet + confidence).
        """
        extracted = []
        seen = set()

        for page_data in pages_content:
            page_num = page_data["page"]
            text = page_data["text"]
            if not text:
                continue

            # 1. Regex Extraction
            for entity_type, pattern in PATTERNS.items():
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    val = match.group(1).strip()
                    key = (entity_type, val.upper())
                    if key in seen:
                        continue
                    seen.add(key)

                    # Extract context snippet (surrounding 40 characters)
                    start_pos = max(0, match.start() - 30)
                    end_pos = min(len(text), match.end() + 30)
                    snippet = text[start_pos:end_pos].replace("\n", " ").strip()

                    extracted.append({
                        "entity_type": entity_type,
                        "entity_value": val.upper() if entity_type in ["GSTIN", "PAN", "CIN", "IFSC"] else val,
                        "confidence_score": 0.98 if entity_type in ["GSTIN", "PAN", "CIN"] else 0.90,
                        "page_number": page_num,
                        "snippet": f"...{snippet}..."
                    })

            # 2. Extract Legal / Trade Name
            name_match = re.search(r"(?:Name of Business|Legal Name|Trade Name|M/s\.?|Company Name)[\s:]+([A-Za-z0-9\s&.,'-]{3,60}(?:Pvt\.?\s*Ltd\.?|Private Limited|LLP|Corporation|Enterprises|Packaging))", text, re.IGNORECASE)
            if name_match:
                company_name = name_match.group(1).strip()
                extracted.append({
                    "entity_type": "LEGAL_NAME",
                    "entity_value": company_name,
                    "confidence_score": 0.92,
                    "page_number": page_num,
                    "snippet": f"...{name_match.group(0)}..."
                })

            # 3. Extract Directors / Key Persons
            director_match = re.findall(r"(?:Director|Partner|Authorised Signatory|Proprietor)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})", text)
            for d in director_match:
                extracted.append({
                    "entity_type": "DIRECTOR",
                    "entity_value": d.strip(),
                    "confidence_score": 0.88,
                    "page_number": page_num,
                    "snippet": f"Director/Signatory: {d.strip()}"
                })

        return extracted

document_ai_service = DocumentAIService()
