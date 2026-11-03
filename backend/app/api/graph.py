from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Supplier
from app.services.graph_engine import graph_engine
from data.fixtures.demo_data import DEMO_SUPPLIERS

router = APIRouter()

@router.get("/{supplier_id}/graph")
def get_supplier_relationship_graph(supplier_id: str, db: Session = Depends(get_db)):
    """
    Returns NetworkX generated graph topology (nodes, edges, centrality signals)
    for interactive visualization.
    """
    demo_match = next((d for d in DEMO_SUPPLIERS if d["supplier_id"] == supplier_id), None)
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    
    if not demo_match and not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    supplier_data = demo_match if demo_match else {
        "supplier_id": supplier.supplier_id,
        "name": supplier.name,
        "address": supplier.address,
        "status": supplier.status,
        "directors": [{"name": "Rajesh Kumar", "other_companies": ["Apex Boxpack Ltd"]}]
    }

    graph_payload = graph_engine.build_supplier_subgraph(supplier_data)
    return graph_payload

# Graph router
