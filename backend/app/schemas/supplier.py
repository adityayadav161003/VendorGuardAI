from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Legal or trade name of the supplier")
    business_type: str = Field(default="Private Limited", max_length=100)
    industry: str = Field(default="Manufacturing", max_length=100)
    website: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=2000)

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

    model_config = ConfigDict(from_attributes=True)
