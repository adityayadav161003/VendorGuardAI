import re
import hashlib
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    import pytesseract
    from PIL import Image
    # Verify the tesseract binary is actually reachable, not just the wrapper
    pytesseract.get_tesseract_version()
    HAS_TESSERACT = True
except Exception:
    HAS_TESSERACT = False

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
    "AMOUNT": r"(?:₹|INR|Rs\.?|USD|\$)\s*([0-9]{1,3}(?:[,][0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)",
}

# Magic-byte signatures used to verify that file content matches its extension
MAGIC_SIGNATURES = {
    ".pdf": b"%PDF-",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
}


def content_matches_extension(file_path: Path, declared_ext: Optional[str] = None) -> bool:
    """Validates that the first bytes of the file match a known signature for
    its extension. Text formats (.txt/.json/.csv) must decode as UTF-8.
    The extension is passed explicitly because uploads are staged under a
    server-generated temp name that carries no extension."""
    ext = (declared_ext or file_path.suffix).lower()
    try:
        with open(file_path, "rb") as f:
            head = f.read(8192)
    except OSError:
        return False
    signature = MAGIC_SIGNATURES.get(ext)
    if signature is not None:
        return head.startswith(signature)
    if ext in {".txt", ".json", ".csv"}:
        try:
            head.decode("utf-8")
            return True
        except UnicodeDecodeError:
            return False
    return False


class DocumentAIService:
    @staticmethod
    def compute_sha256(file_path: Path) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for block in iter(lambda: f.read(65536), b""):
                sha256.update(block)
        return sha256.hexdigest()

    @staticmethod
    def ocr_image(file_path: Path) -> str:
        """Runs OCR on an image when tesseract is installed. Returns '' when
        OCR is unavailable — callers must treat empty text as UNREADABLE, not
        as healthy."""
        if not HAS_TESSERACT:
            return ""
        try:
            return pytesseract.image_to_string(Image.open(file_path)) or ""
        except Exception:
            return ""

    @staticmethod
    def extract_text_from_file(file_path: Path, max_pages: int = 50) -> List[Dict[str, Any]]:
        """
        Extracts text page by page.
        Returns a list of dicts: [{"page": 1, "text": "..."}]
        Page caps bound pypdf decompression work (parser-abuse defence).
        """
        pages_content = []
        ext = file_path.suffix.lower()

        if ext == ".pdf" and HAS_PYPDF:
            try:
                reader = PdfReader(str(file_path))
                for idx, page in enumerate(reader.pages[:max_pages]):
                    text = page.extract_text() or ""
                    pages_content.append({"page": idx + 1, "text": text.strip()})
            except Exception as e:
                pages_content.append({"page": 1, "text": f"[Error reading PDF: {e}]"})
        elif ext in {".png", ".jpg", ".jpeg"}:
            text = DocumentAIService.ocr_image(file_path)
            pages_content.append({"page": 1, "text": text.strip()})
        elif ext in {".txt", ".csv"}:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    pages_content.append({"page": 1, "text": f.read().strip()})
            except Exception as e:
                pages_content.append({"page": 1, "text": f"[Error reading text file: {e}]"})
        elif ext == ".json":
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    data = json.load(f)
                pages_content.append({"page": 1, "text": json.dumps(data, indent=2)[:100000]})
            except Exception as e:
                pages_content.append({"page": 1, "text": f"[Error reading JSON: {e}]"})
        else:
            # Fallback for unknown formats
            pages_content.append({"page": 1, "text": ""})

        return pages_content

    @staticmethod
    def is_unreadable(pages_content: List[Dict[str, Any]]) -> bool:
        """True when no page yielded meaningful text (scanned image without OCR,
        encrypted PDF, empty file, ...). Reader-error placeholders also count as
        unreadable — error text must never be scored as a healthy document."""
        for p in pages_content:
            text = (p.get("text") or "").strip()
            if text.startswith("[Error reading"):
                continue
            if len(text) >= 20:
                return False
        return True

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
