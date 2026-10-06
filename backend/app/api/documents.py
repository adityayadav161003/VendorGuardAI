import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.entities import Supplier, Document, ExtractedEntity, User
from app.schemas.document import DocumentResponse
from app.services.document_ai import document_ai_service, content_matches_extension
from app.services.audit import record_event

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".json", ".csv", ".png", ".jpg", ".jpeg"}
MAX_DOCUMENT_TYPE_LENGTH = 50
CHUNK_SIZE = 1024 * 1024  # stream copies in 1MB chunks


@router.get("/{supplier_id}/documents", response_model=List[DocumentResponse])
def get_supplier_documents(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = db.query(Document).filter(Document.supplier_id == supplier_id).all()
    return docs


@router.post("/{supplier_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    supplier_id: str,
    document_type: str = Form(default="OTHER"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AC1: Supported PDF/image/text uploads are stored and processed or fail safely.
    AC2: Extracted fields show source page/snippet and confidence where available.

    Upload-safety defences:
    - size enforced while streaming (never write-then-check),
    - content validated against magic bytes (no disguised executables),
    - filename replaced by a server-generated uuid (no traversal/overwrite),
    - duplicate content hashes rejected,
    - unreadable content flagged NEEDS_OCR instead of being scored as healthy.
    """
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name provided.")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    document_type = document_type.strip().upper()[:MAX_DOCUMENT_TYPE_LENGTH] or "OTHER"

    # Content/size validation happens on a temp file BEFORE the canonical store
    temp_path = settings.UPLOADS_DIR / f".tmp-{uuid.uuid4().hex}"
    bytes_written = 0
    try:
        with open(temp_path, "wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > settings.MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds the maximum allowed size of {settings.MAX_FILE_SIZE // (1024 * 1024)}MB."
                    )
                buffer.write(chunk)
    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to receive the uploaded file.")

    if bytes_written == 0:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if not content_matches_extension(temp_path, declared_ext=file_ext):
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="File content does not match its extension (expected a real "
                   f"{file_ext} file). Upload rejected."
        )

    # Server-generated storage name: the original name lives only in the database
    target_filename = f"{supplier_id}_{uuid.uuid4().hex[:12]}{file_ext}"
    target_path = settings.UPLOADS_DIR / target_filename
    shutil.move(str(temp_path), str(target_path))

    file_hash = document_ai_service.compute_sha256(target_path)

    # Duplicate-upload detection via content hash (tamper evidence + dedupe)
    duplicate = (
        db.query(Document)
        .filter(Document.supplier_id == supplier_id, Document.file_hash == file_hash)
        .first()
    )
    if duplicate:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=409,
            detail=f"An identical file was already uploaded for this supplier "
                   f"('{duplicate.file_name}'). Duplicate uploads are rejected."
        )

    try:
        pages_content = document_ai_service.extract_text_from_file(
            target_path, max_pages=settings.MAX_PDF_PAGES
        )
    except Exception as e:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Could not read the file: {e}")

    unreadable = document_ai_service.is_unreadable(pages_content)
    combined_text = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in pages_content])

    doc_record = Document(
        supplier_id=supplier_id,
        document_type=document_type,
        file_name=file.filename,
        file_path=str(target_path),
        file_hash=file_hash,
        file_size=bytes_written,
        extracted_text=combined_text[:10000],
        metadata_json={"needs_ocr": unreadable} if unreadable else {},
        status="NEEDS_OCR" if unreadable else "PROCESSED",
        uploaded_by=current_user.user_id,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    # Extract entities with provenance (AC2)
    extracted_entities = [] if unreadable else document_ai_service.extract_entities_with_provenance(pages_content)
    for ent in extracted_entities:
        ee = ExtractedEntity(
            document_id=doc_record.document_id,
            entity_type=ent["entity_type"],
            entity_value=ent["entity_value"],
            confidence_score=ent["confidence_score"],
            page_number=ent["page_number"],
            snippet=ent["snippet"]
        )
        db.add(ee)
    db.commit()
    db.refresh(doc_record)

    record_event(db, "DOCUMENT_UPLOADED", doc_record.document_id, user_id=current_user.user_id, details={
        "supplier_id": supplier_id,
        "document_type": doc_record.document_type,
        "entities_extracted": len(extracted_entities),
        "unreadable": unreadable,
    })
    db.commit()

    return doc_record


@router.get("/{supplier_id}/extracted-entities")
def get_supplier_extracted_entities(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns all extracted entities across documents for the given supplier with confidence and provenance."""
    docs = db.query(Document).filter(Document.supplier_id == supplier_id).all()
    doc_map = {d.document_id: d.file_name for d in docs}
    doc_ids = list(doc_map.keys())
    if not doc_ids:
        return []
    entities = db.query(ExtractedEntity).filter(ExtractedEntity.document_id.in_(doc_ids)).all()
    return [
        {
            "id": e.entity_id,
            "document_id": e.document_id,
            "document_name": doc_map.get(e.document_id, "Document"),
            "page_number": e.page_number,
            "entity_type": e.entity_type,
            "entity_value": e.entity_value,
            "confidence": e.confidence_score,
            "snippet": e.snippet,
            "bounding_box": e.bounding_box,
        }
        for e in entities
    ]
