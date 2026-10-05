"""
Evidence Store & Retrieval Layer.

Builds a unified, provenance-carrying evidence pool for a supplier from:
  1. Uploaded documents in the database (page-level passages + extracted entities)
  2. Permitted external/demo fixture sources (only for seeded demo suppliers)

Every evidence item carries: evidence_id, source_type, title (document name or
source title), snippet, page number, reliability score and origin. Downstream
consumers (analysis, chat, claim verification, export) all read from this pool
so that no statement can appear without a traceable source.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.entities import Document, ExtractedEntity
from data.fixtures.demo_data import DEMO_SUPPLIERS

STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "with", "and", "or", "to",
    "in", "of", "for", "on", "at", "by", "from", "as", "it", "its", "this",
    "that", "be", "been", "has", "have", "had", "do", "does", "did", "not",
    "but", "if", "then", "than", "so", "such", "can", "will", "would", "should",
    "there", "their", "them", "they", "what", "which", "who", "whom", "when",
    "where", "why", "how", "you", "your", "we", "our", "i", "me", "my",
    "other", "also", "many", "much", "some", "any",
}

PASSAGE_TARGET_CHARS = 600


def stable_evidence_id(prefix: str, *parts: str) -> str:
    """Deterministic id so the same evidence is not persisted twice."""
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}-{digest}"


def _chunk_passages(text: str, page: int) -> List[str]:
    """Split a page's text into sentence-boundary passages of ~600 chars."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text)
    passages: List[str] = []
    buffer = ""
    for sentence in sentences:
        if buffer and len(buffer) + len(sentence) + 1 > PASSAGE_TARGET_CHARS:
            passages.append(buffer.strip())
            buffer = sentence
        else:
            buffer = f"{buffer} {sentence}".strip()
    if buffer:
        passages.append(buffer.strip())
    return [p for p in passages if len(p) > 20]


def tokenize(text: str) -> set:
    """Content tokens, expanded with naive singular forms so plural queries
    ('directors') match singular evidence ('director')."""
    base = {w for w in re.findall(r"\w+", text.lower()) if w not in STOP_WORDS and len(w) > 2}
    expanded = set(base)
    for word in base:
        if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
            expanded.add(word[:-1])
    return expanded


# Words so common in this domain that they carry no retrieval signal on their own
DOMAIN_GENERIC_WORDS = {
    "supplier", "suppliers", "company", "companies", "vendor", "vendors",
    "records", "record", "document", "documents", "information", "details",
    "provide", "tell", "entity", "entities", "firm", "firms",
}


def query_tokens(query: str) -> set:
    """Query tokens with domain-generic words (and their singular forms)
    removed, so off-topic questions retrieve nothing instead of matching on
    'supplier'."""
    return tokenize(query) - tokenize(" ".join(DOMAIN_GENERIC_WORDS))


class EvidenceStoreService:
    def build_evidence_pool(self, db: Session, supplier_id: str) -> Dict[str, Any]:
        """
        Returns {evidence_pool, passages, document_count, entities, data_source}
        where every item is fully provenance-tagged.
        """
        evidence_pool: List[Dict[str, Any]] = []
        passages: List[Dict[str, Any]] = []
        entities: List[ExtractedEntity] = []

        docs = (
            db.query(Document)
            .filter(Document.supplier_id == supplier_id)
            .order_by(Document.upload_time)
            .all()
        )

        for doc in docs:
            doc_entities = (
                db.query(ExtractedEntity)
                .filter(ExtractedEntity.document_id == doc.document_id)
                .all()
            )
            entities.extend(doc_entities)

            # Entity-level evidence (strongest provenance: page + snippet)
            for ent in doc_entities:
                evidence_pool.append({
                    "evidence_id": stable_evidence_id("ev-doc", ent.entity_id),
                    "source_type": f"DOCUMENT:{doc.document_type}",
                    "title": doc.file_name,
                    "snippet": ent.snippet or f"{ent.entity_type}: {ent.entity_value}",
                    "reliability_score": float(ent.confidence_score or 0.9),
                    "document_id": doc.document_id,
                    "page": int(ent.page_number or 1),
                    "origin": "UPLOADED_DOCUMENT",
                })

            # Passage-level evidence from extracted text
            for page_text in (doc.extracted_text or "").split("--- Page "):
                if not page_text.strip():
                    continue
                page_match = re.match(r"^(\d+)\s*---\s*(.*)$", page_text, re.DOTALL)
                if page_match:
                    page_num, body = int(page_match.group(1)), page_match.group(2)
                else:
                    page_num, body = 1, page_text
                for chunk in _chunk_passages(body, page_num):
                    passage_id = stable_evidence_id("ev-pg", doc.document_id, chunk)
                    evidence_pool.append({
                        "evidence_id": passage_id,
                        "source_type": f"DOCUMENT:{doc.document_type}",
                        "title": doc.file_name,
                        "snippet": chunk,
                        "reliability_score": 0.90,
                        "document_id": doc.document_id,
                        "page": page_num,
                        "origin": "UPLOADED_DOCUMENT",
                    })
                    passages.append({
                        "evidence_id": passage_id,
                        "document_id": doc.document_id,
                        "title": doc.file_name,
                        "page": page_num,
                        "text": chunk,
                    })

        # Permitted fixture evidence for seeded demo suppliers
        fixture_evidence: List[Dict[str, Any]] = []
        demo = next((d for d in DEMO_SUPPLIERS if d["supplier_id"] == supplier_id), None)
        if demo:
            for ev in demo.get("evidence_sources", []):
                item = {
                    "evidence_id": ev.get("evidence_id", stable_evidence_id("ev-fx", ev.get("title", ""))),
                    "source_type": ev.get("source_type", "EXTERNAL_SOURCE"),
                    "title": ev.get("title", "External Source"),
                    "snippet": ev.get("snippet", ""),
                    "reliability_score": float(ev.get("reliability_score", 0.9)),
                    "document_id": None,
                    "page": 1,
                    "origin": "DEMO_FIXTURE",
                }
                evidence_pool.append(item)
                fixture_evidence.append(item)

        document_count = len(docs)
        unreadable_count = sum(
            1 for d in docs
            if d.status == "NEEDS_OCR" or (d.metadata_json or {}).get("needs_ocr")
            or not (d.extracted_text or "").strip()
        )
        if document_count > 0:
            data_source = "UPLOADED_DOCUMENTS"
        elif fixture_evidence:
            data_source = "DEMO_FIXTURES"
        else:
            data_source = "NO_EVIDENCE"

        return {
            "evidence_pool": evidence_pool,
            "passages": passages,
            "entities": entities,
            "document_count": document_count,
            "unreadable_count": unreadable_count if document_count > 0 else 0,
            "data_source": data_source,
        }

    def retrieve_evidence(
        self, query: str, evidence_pool: List[Dict[str, Any]], k: int = 3
    ) -> List[Tuple[float, Dict[str, Any]]]:
        """
        Lexical retrieval over the evidence pool. Returns top-k (score, evidence)
        pairs. Domain-term boosts steer retrieval toward the asked-about topic.
        """
        q_words = query_tokens(query)
        if not q_words:
            return []

        topic_boosts = {
            "bank": {"bank", "account", "ifsc", "cheque", "holder", "statement"},
            "gst": {"gstin", "gst", "tax", "pan"},
            "iso": {"iso", "certificate", "certification", "expiry", "expiring"},
            "director": {"director", "din", "signatory", "network"},
            "legal": {"registered", "incorporated", "cin", "company"},
        }
        boost_terms: set = set()
        for key, terms in topic_boosts.items():
            if any(t in q_words for t in terms):
                boost_terms |= terms

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for ev in evidence_pool:
            ev_words = tokenize(f"{ev.get('title', '')} {ev.get('snippet', '')}")
            if not ev_words:
                continue
            overlap = len(q_words & ev_words) / len(q_words)
            topic_boost = 0.25 * (len(q_words & boost_terms) / len(q_words)) if boost_terms else 0.0
            score = overlap + topic_boost
            if score > 0:
                scored.append((score, ev))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return scored[:k]


evidence_store = EvidenceStoreService()
