"""
Graph Intelligence Engine using NetworkX.

Builds an explainable relationship graph across:
- Focal Supplier
- Directors / Signatories
- Related Entities / Sister Companies
- Registered Addresses
- Bank Accounts

Soft wording guideline:
"Shared attribute detected; review recommended". Never imply fraud or legal finding.
"""

from typing import Dict, List, Any
import networkx as nx


class GraphIntelligenceEngine:
    def __init__(self):
        self.graph = nx.Graph()

    def build_supplier_subgraph(self, supplier_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds a NetworkX graph for a supplier and their connected entities.
        Returns Cytoscape/Force-graph compatible JSON {nodes: [...], edges: [...]}.
        """
        G = nx.Graph()
        supplier_id = supplier_data.get("supplier_id", "s-1")
        supplier_name = supplier_data.get("name", "Unknown Supplier")

        # 1. Primary Supplier Node (Heritage Olive)
        G.add_node(
            supplier_id,
            label=supplier_name,
            node_type="SUPPLIER",
            status=supplier_data.get("status", "REVIEW_PENDING"),
            color="#4A5D23",
            size=32
        )

        # 2. Directors / Key Signatories (Warm Ink/Brown)
        directors = supplier_data.get("directors", [])
        for d in directors:
            d_name = d.get("name", "Director")
            d_id = f"dir_{d_name.lower().replace(' ', '_')}"
            G.add_node(
                d_id,
                label=d_name,
                node_type="DIRECTOR",
                din=d.get("din", "N/A"),
                color="#6B5B4B",
                size=24
            )
            G.add_edge(supplier_id, d_id, relation="HAS_DIRECTOR", weight=1.0)

            # Check for shared directorships with sister/other companies (Brass/Gold)
            other_companies = d.get("other_companies", [])
            for comp in other_companies:
                comp_id = f"comp_{comp.lower().replace(' ', '_')}"
                G.add_node(
                    comp_id,
                    label=comp,
                    node_type="RELATED_ENTITY",
                    color="#C49A5A",
                    size=22
                )
                G.add_edge(d_id, comp_id, relation="DIRECTOR_OF", weight=1.0)
                # Soft relationship edge
                G.add_edge(supplier_id, comp_id, relation="SHARED_DIRECTOR_LINK", weight=0.5, style="dashed")

        # 3. Registered Address Node (Muted Gold)
        address = supplier_data.get("address")
        if address:
            addr_id = f"addr_{supplier_id}"
            short_addr = address[:32] + ("…" if len(address) > 32 else "")
            G.add_node(
                addr_id,
                label=short_addr,
                full_address=address,
                node_type="ADDRESS",
                color="#B8862F",
                size=20
            )
            G.add_edge(supplier_id, addr_id, relation="REGISTERED_AT", weight=1.0)

        # 4. Bank Account Node (Sage / Soft Green)
        bank_account = supplier_data.get("bank_account")
        if bank_account:
            acct_num = bank_account.get("account_number", "N/A")
            bank_id = f"bank_{acct_num}"
            G.add_node(
                bank_id,
                label=f"A/C: {acct_num}",
                bank_name=bank_account.get("bank_name", "Bank"),
                holder_name=bank_account.get("holder_name", "N/A"),
                node_type="BANK_ACCOUNT",
                color="#5B7A2F",
                size=20
            )
            G.add_edge(supplier_id, bank_id, relation="USES_BANK_ACCOUNT", weight=1.0)

        # 5. Extract Network Signals with Soft Wording
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
        Detects graph patterns using non-accusatory, soft advisory language:
        "Shared attribute detected; review recommended".
        """
        signals = []
        related_entities = [n for n, a in G.nodes(data=True) if a.get("node_type") == "RELATED_ENTITY"]

        if len(related_entities) > 0:
            connected_names = [G.nodes[n]["label"] for n in related_entities]
            signals.append({
                "type": "SHARED_DIRECTOR_NETWORK",
                "severity": "warning",
                "message": f"Shared attribute detected; review recommended ({len(related_entities)} related companies / external entities share common directorship)",
                "details": f"Connected external entities on record: {', '.join(connected_names)}",
                "reason_code": "NET_SHARED_DIRECTOR"
            })

        # Calculate degree centrality
        degrees = dict(G.degree())
        for node, deg in degrees.items():
            if G.nodes[node].get("node_type") == "DIRECTOR" and deg > 2:
                signals.append({
                    "type": "HIGH_CENTRALITY_DIRECTOR",
                    "severity": "info",
                    "message": f"Shared attribute detected; review recommended (Director '{G.nodes[node]['label']}' is associated with {deg} entities in graph)",
                    "director": G.nodes[node]["label"],
                    "reason_code": "NET_HIGH_CENTRALITY"
                })

        return signals


graph_engine = GraphIntelligenceEngine()
