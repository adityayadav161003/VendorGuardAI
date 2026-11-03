from app.services.graph_engine import graph_engine

def test_ac6_planted_graph_pattern_detection():
    """AC6: Detects planted suspicious graph patterns (shared director with related entities)."""
    supplier_data = {
        "supplier_id": "sup-abc-pkg-001",
        "name": "ABC Packaging Pvt Ltd",
        "address": "Sector 62, Noida",
        "directors": [
            {
                "name": "Rajesh Kumar",
                "other_companies": ["Apex Boxpack Ltd", "Global Polyfilms Pvt Ltd"]
            }
        ],
        "bank_account": {
            "account_number": "987654321012"
        }
    }

    graph_payload = graph_engine.build_supplier_subgraph(supplier_data)
    
    assert graph_payload["summary"]["total_nodes"] >= 4
    assert graph_payload["summary"]["total_edges"] >= 4
    assert graph_payload["summary"]["related_entities_count"] == 2

    # Check for anomaly signal
    signals = graph_payload["summary"]["network_signals"]
    assert any(s["type"] == "SHARED_DIRECTOR_NETWORK" for s in signals)
    shared_signal = next(s for s in signals if s["type"] == "SHARED_DIRECTOR_NETWORK")
    assert "2 related companies" in shared_signal["message"]

# AC6 test suite
