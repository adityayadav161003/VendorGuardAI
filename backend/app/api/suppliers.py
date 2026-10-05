from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Supplier
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierUpdate
from app.services.audit import record_event
from app.core.security import get_current_user, require_roles
from app.models.entities import User
from data.fixtures.demo_data import DEMO_SUPPLIERS

router = APIRouter()

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all registered suppliers, seeded with demo fixtures if empty."""
    suppliers = db.query(Supplier).all()
    if not suppliers:
        # Seed initial demo suppliers
        for ds in DEMO_SUPPLIERS:
            s = Supplier(
                supplier_id=ds["supplier_id"],
                name=ds["name"],
                business_type=ds["business_type"],
                industry=ds["industry"],
                website=ds.get("website"),
                address=ds.get("address"),
                status=ds.get("status", "REVIEW_PENDING")
            )
            db.add(s)
        db.commit()
        suppliers = db.query(Supplier).all()
    return suppliers

@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(supplier_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        # Fallback check demo fixtures
        for ds in DEMO_SUPPLIERS:
            if ds["supplier_id"] == supplier_id:
                s = Supplier(
                    supplier_id=ds["supplier_id"],
                    name=ds["name"],
                    business_type=ds["business_type"],
                    industry=ds["industry"],
                    website=ds.get("website"),
                    address=ds.get("address"),
                    status=ds.get("status", "REVIEW_PENDING")
                )
                db.add(s)
                db.commit()
                return s
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    supplier = Supplier(
        name=payload.name,
        business_type=payload.business_type,
        industry=payload.industry,
        website=payload.website,
        address=payload.address,
        status="REVIEW_PENDING"
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    record_event(db, "SUPPLIER_CREATED", supplier.supplier_id, user_id=current_user.user_id, details={"name": supplier.name})
    db.commit()
    supplier.created_by = current_user.user_id
    db.commit()
    return supplier


VALID_SUPPLIER_STATUSES = {"REVIEW_PENDING", "VERIFIED", "FLAGGED", "REJECTED"}


@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    reviewer: User = Depends(require_roles("reviewer")),
):
    """Edit supplier profile fields / record the human review status decision."""
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="No fields to update provided")

    if "status" in changes and changes["status"] not in VALID_SUPPLIER_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{changes['status']}'. Allowed: {', '.join(sorted(VALID_SUPPLIER_STATUSES))}"
        )

    for field, value in changes.items():
        setattr(supplier, field, value)

    db.commit()
    db.refresh(supplier)
    record_event(db, "SUPPLIER_UPDATED", supplier_id, user_id=reviewer.user_id, details={"changed_fields": sorted(changes.keys())})
    db.commit()
    return supplier
