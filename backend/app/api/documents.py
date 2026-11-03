import shutil
from pathlib import Path
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.entities import Supplier, Document, ExtractedEntity
from app.schemas.document import DocumentResponse
from app.services.document_ai import document_ai_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".json", ".csv", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@router.get("/{supplier_id}/documents", response_model=List[DocumentResponse])
def get_supplier_documents(supplier_id: str, db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.supplier_id == supplier_id).all()
    return docs

@router.post("/{supplier_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    supplier_id: str,
    document_type: str = Form(default="OTHER"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    AC1: Supported PDF/image uploads are stored and processed or fail safely.
    AC2: Extracted fields show source page/snippet and confidence where available.
    """
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Save to protected uploads directory
    target_filename = f"{supplier_id}_{Path(file.filename).name}"
    target_path = settings.UPLOADS_DIR / target_filename

    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store file: {e}")

    file_size = target_path.stat().st_size
    if file_size > MAX_FILE_SIZE:
        target_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size of 10MB.")

    file_hash = document_ai_service.compute_sha256(target_path)

    # Extract pages and text
    pages_content = document_ai_service.extract_text_from_file(target_path)
    combined_text = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in pages_content])

    # Create document record
    doc_record = Document(
        supplier_id=supplier_id,
        document_type=document_type.upper(),
        file_name=file.filename,
        file_path=str(target_path),
        file_hash=file_hash,
        file_size=file_size,
        extracted_text=combined_text[:10000],  # store up to 10k chars text sample
        status="PROCESSED"
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    # Extract entities with provenance (AC2)
    extracted_entities = document_ai_service.extract_entities_with_provenance(pages_content)
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

    return doc_record

# Documents upload router
