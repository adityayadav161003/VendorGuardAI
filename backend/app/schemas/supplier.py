from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class SupplierBase(BaseModel):
    name: str = Field(..., description="Legal or trade name of the supplier")
    business_type: str = Field(default="Private Limited")
    industry: str = Field(default="Manufacturing")
    website: Optional[str] = None
    address: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None

class SupplierResponse(SupplierBase):
    supplier_id: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# Supplier DTOs
# Type annotations
