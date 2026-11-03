from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class ExtractedEntityResponse(BaseModel):
    entity_id: str
    document_id: str
    entity_type: str
    entity_value: str
    confidence_score: float
    page_number: int
    snippet: Optional[str] = None

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    document_id: str
    supplier_id: str
    document_type: str
    file_name: str
    file_size: int
    file_hash: Optional[str] = None
    status: str
    upload_time: datetime
    metadata_json: Dict[str, Any] = {}
    extracted_entities: List[ExtractedEntityResponse] = []

    class Config:
        from_attributes = True

# Document response models
