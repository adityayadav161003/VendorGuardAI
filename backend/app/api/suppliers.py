from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Supplier
from app.schemas.supplier import SupplierCreate, SupplierResponse, SupplierUpdate
from data.fixtures.demo_data import DEMO_SUPPLIERS

router = APIRouter()

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
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
def get_supplier(supplier_id: str, db: Session = Depends(get_db)):
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
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
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
    return supplier

# Suppliers router
