"""
Supplier Self-Service Portal API.
Provides tokenized, expiring, upload-only access for external vendors to submit statutory documents.
"""

import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.entities import Supplier, SupplierInvite, Document, SupplierTimeline, User
from app.services.file_safety import validate_file_safety
from app.services.document_ai import document_ai_service
from app.services.audit import record_event

router = APIRouter()

DEFAULT_REQUIRED_DOCS = [
    "GST_CERT",
    "PAN_CARD",
    "INCORPORATION",
    "BANK_STATEMENT",
    "ISO_CERT"
]


class CreateInviteRequest(BaseModel):
    expires_in_days: int = Field(default=7, ge=1, le=60)
    required_docs: Optional[List[str]] = Field(default=None)


@router.post("/suppliers/{supplier_id}/invites")
def create_supplier_invite(
    supplier_id: str,
    payload: CreateInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates a secure, tokenized, expiring upload-only invite link for a supplier."""
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
    req_docs = payload.required_docs or DEFAULT_REQUIRED_DOCS

    invite = SupplierInvite(
        supplier_id=supplier.supplier_id,
        invite_token=token,
        created_by=current_user.user_id,
        required_docs=req_docs,
        expires_at=expires_at,
        is_active=1,
    )
    db.add(invite)

    # Record in supplier timeline
    timeline = SupplierTimeline(
        supplier_id=supplier.supplier_id,
        event_type="INVITE_GENERATED",
        title="Supplier Self-Service Invite Generated",
        description=f"Generated invite link valid for {payload.expires_in_days} days by {current_user.name}.",
        metadata_json={"expires_at": expires_at.isoformat(), "required_docs": req_docs},
    )
    db.add(timeline)
    db.commit()
    db.refresh(invite)

    record_event(
        db,
        action="SUPPLIER_INVITE_CREATED",
        object_id=invite.invite_id,
        user_id=current_user.user_id,
        details={"supplier_id": supplier_id, "expires_at": expires_at.isoformat()}
    )

    return {
        "invite_id": invite.invite_id,
        "invite_token": token,
        "portal_url": f"/portal/upload/{token}",
        "expires_at": expires_at.isoformat(),
        "required_docs": req_docs,
    }


@router.get("/portal/invite/{token}")
def get_portal_invite_details(token: str, db: Session = Depends(get_db)):
    """Public endpoint to verify invite token validity and retrieve document checklist."""
    invite = db.query(SupplierInvite).filter(SupplierInvite.invite_token == token).first()
    if not invite or not invite.is_active:
        raise HTTPException(status_code=404, detail="Invalid or deactivated invite token.")

    # Check expiry
    now = datetime.now(timezone.utc)
    exp = invite.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        raise HTTPException(status_code=410, detail="Invite link has expired. Request a new invite from the buyer.")

    supplier = db.query(Supplier).filter(Supplier.supplier_id == invite.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Associated supplier record not found.")

    # Check existing documents uploaded
    existing_docs = (
        db.query(Document)
        .filter(Document.supplier_id == supplier.supplier_id)
        .all()
    )
    uploaded_types = {d.document_type for d in existing_docs}

    checklist = []
    for r in invite.required_docs:
        checklist.append({
            "document_type": r,
            "label": r.replace("_", " ").title(),
            "status": "UPLOADED" if r in uploaded_types else "PENDING",
        })

    return {
        "supplier_name": supplier.name,
        "expires_at": invite.expires_at.isoformat(),
        "checklist": checklist,
        "allowed_formats": ["PDF", "PNG", "JPEG", "TXT"],
        "max_size_mb": 15,
    }


@router.post("/portal/invite/{token}/upload")
async def portal_upload_document(
    token: str,
    file: UploadFile = File(...),
    document_type: str = Form("OTHER"),
    db: Session = Depends(get_db),
):
    """
    Public upload-only endpoint for external suppliers to submit a document.
    Enforces strict safety validation, associates file with supplier, and records audit trail.
    """
    invite = db.query(SupplierInvite).filter(SupplierInvite.invite_token == token).first()
    if not invite or not invite.is_active:
        raise HTTPException(status_code=404, detail="Invalid invite token.")

    now = datetime.now(timezone.utc)
    exp = invite.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now:
        raise HTTPException(status_code=410, detail="Invite has expired.")

    supplier = db.query(Supplier).filter(Supplier.supplier_id == invite.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")

    content = await file.read()
    filename = file.filename or "upload.dat"

    # Strict file safety check
    is_safe, error_msg = validate_file_safety(filename, content, file.content_type or "")
    if not is_safe:
        raise HTTPException(status_code=400, detail=error_msg)

    # Save to storage directory
    os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
    import uuid
    safe_name = f"{uuid.uuid4()}_{os.path.basename(filename)}"
    dest_path = os.path.join(settings.UPLOADS_DIR, safe_name)
    with open(dest_path, "wb") as f:
        f.write(content)

    import hashlib
    file_hash = hashlib.sha256(content).hexdigest()

    doc = Document(
        supplier_id=supplier.supplier_id,
        document_type=document_type.upper(),
        file_name=filename,
        file_path=dest_path,
        file_hash=file_hash,
        file_size=len(content),
        uploaded_by="SUPPLIER_PORTAL",
        status="PROCESSED",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Process entities
    try:
        document_ai_service.process_document(db, doc.document_id)
    except Exception as exc:
        doc.status = "NEEDS_OCR"
        db.commit()

    # Add timeline notification to buyer
    timeline = SupplierTimeline(
        supplier_id=supplier.supplier_id,
        event_type="DOCUMENT_UPLOADED",
        title=f"Document Uploaded: {filename}",
        description=f"Supplier uploaded statutory document ({document_type}) via self-service portal.",
        metadata_json={"document_id": doc.document_id, "file_name": filename, "document_type": document_type},
    )
    db.add(timeline)
    db.commit()

    record_event(
        db,
        action="PORTAL_DOCUMENT_UPLOADED",
        object_id=doc.document_id,
        user_id=None,
        details={"supplier_id": supplier.supplier_id, "filename": filename, "type": document_type}
    )

    return {
        "document_id": doc.document_id,
        "file_name": doc.file_name,
        "status": doc.status,
        "message": f"Document '{filename}' successfully uploaded and attached to supplier verification file.",
    }
