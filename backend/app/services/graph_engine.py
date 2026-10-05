from typing import Dict, List, Any, Set
import networkx as nx

class GraphIntelligenceEngine:
    def __init__(self):
        self.graph = nx.Graph()

    def build_supplier_subgraph(self, supplier_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds a NetworkX graph for a supplier and their connected entities
        (directors, addresses, bank accounts, related sister entities).
        Returns Cytoscape/Force-graph compatible JSON {nodes: [...], edges: [...]}.
        """
        G = nx.Graph()
        supplier_id = supplier_data.get("supplier_id", "s-1")
        supplier_name = supplier_data.get("name", "Unknown Supplier")

        # 1. Primary Supplier Node
        G.add_node(
            supplier_id,
            label=supplier_name,
            node_type="SUPPLIER",
            status=supplier_data.get("status", "VERIFIED"),
            color="#3b82f6",
            size=30
        )

        # 2. Directors / Key Signatories
        directors = supplier_data.get("directors", [])
        for d in directors:
            d_id = f"dir_{d['name'].lower().replace(' ', '_')}"
            G.add_node(
                d_id,
                label=d["name"],
                node_type="DIRECTOR",
                din=d.get("din", "N/A"),
                color="#8b5cf6",
                size=22
            )
            G.add_edge(supplier_id, d_id, relation="HAS_DIRECTOR", weight=1.0)

            # Check for shared directorships with sister/other companies
            other_companies = d.get("other_companies", [])
            for comp in other_companies:
                comp_id = f"comp_{comp.lower().replace(' ', '_')}"
                G.add_node(
                    comp_id,
                    label=comp,
                    node_type="RELATED_ENTITY",
                    color="#f59e0b",
                    size=24
                )
                G.add_edge(d_id, comp_id, relation="DIRECTOR_OF", weight=1.0)
                # Indirect edge for fraud ring visualization
                G.add_edge(supplier_id, comp_id, relation="SHARED_DIRECTOR_NETWORK", weight=0.5, style="dashed")

        # 3. Registered Address Node
        address = supplier_data.get("address")
        if address:
            addr_id = f"addr_{supplier_id}"
            G.add_node(
                addr_id,
                label=address[:30] + ("..." if len(address) > 30 else ""),
                full_address=address,
                node_type="ADDRESS",
                color="#10b981",
                size=20
            )
            G.add_edge(supplier_id, addr_id, relation="REGISTERED_AT", weight=1.0)

        # 4. Bank Account Node
        bank_account = supplier_data.get("bank_account")
        if bank_account:
            bank_id = f"bank_{bank_account.get('account_number', 'unknown')}"
            G.add_node(
                bank_id,
                label=f"A/C: {bank_account.get('account_number', 'N/A')}",
                bank_name=bank_account.get("bank_name", "Bank"),
                holder_name=bank_account.get("holder_name", "N/A"),
                node_type="BANK_ACCOUNT",
                color="#06b6d4",
                size=20
            )
            G.add_edge(supplier_id, bank_id, relation="USES_BANK_ACCOUNT", weight=1.0)

        # 5. Extract Network Anomalies
        network_signals = self.detect_network_anomalies(G, supplier_id)

        # Format for UI visualization
        nodes_list = []
        for node_id, attrs in G.nodes(data=True):
            nodes_list.append({"id": node_id, **attrs})

        edges_list = []
        for u, v, attrs in G.edges(data=True):
            edges_list.append({"source": u, "target": v, **attrs})

        return {
            "supplier_id": supplier_id,
            "nodes": nodes_list,
            "edges": edges_list,
            "summary": {
                "total_nodes": G.number_of_nodes(),
                "total_edges": G.number_of_edges(),
                "related_entities_count": sum(1 for _, a in G.nodes(data=True) if a.get("node_type") == "RELATED_ENTITY"),
                "network_signals": network_signals
            }
        }

    def detect_network_anomalies(self, G: nx.Graph, focal_supplier_id: str) -> List[Dict[str, Any]]:
        """
        Detects suspicious graph patterns:
        - High degree centrality on directors (shared across >= 2 companies)
        - Shell company patterns
        """
        signals = []
        related_entities = [n for n, a in G.nodes(data=True) if a.get("node_type") == "RELATED_ENTITY"]
        
        if len(related_entities) > 0:
            signals.append({
                "type": "SHARED_DIRECTOR_NETWORK",
                "severity": "warning",
                "message": f"{len(related_entities)} related companies share the same director",
                "details": f"Director connected to: {', '.join([G.nodes[n]['label'] for n in related_entities])}"
            })

        # Calculate degree centrality
        degrees = dict(G.degree())
        for node, deg in degrees.items():
            if G.nodes[node].get("node_type") == "DIRECTOR" and deg > 2:
                signals.append({
                    "type": "HIGH_CENTRALITY_DIRECTOR",
                    "severity": "info",
                    "message": f"Director '{G.nodes[node]['label']}' exhibits high network centrality (degree: {deg}).",
                    "director": G.nodes[node]["label"]
                })

        return signals

graph_engine = GraphIntelligenceEngine()
