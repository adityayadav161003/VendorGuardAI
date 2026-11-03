export interface Supplier {
  supplier_id: string;
  name: string;
  business_type: string;
  industry: string;
  website?: string;
  address?: string;
  status: string;
  created_at: string;
}

export interface RiskBreakdown {
  identity: number;
  documents: number;
  financial: number;
  operational: number;
  network: number;
  reputation: number;
}

export interface KeyFinding {
  id: string;
  severity: 'success' | 'info' | 'warning' | 'danger';
  message: string;
  category: string;
  source_reference?: string;
  page_number?: number;
}

export interface ClaimVerification {
  claim_id: string;
  claim_text: string;
  claim_type: string;
  status: 'SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_EVIDENCE';
  confidence_score: number;
  evidence_snippet?: string;
  source_doc_name?: string;
}

export interface AnalysisReport {
  analysis_id: string;
  supplier_id: string;
  supplier_name: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  risk_breakdown: RiskBreakdown;
  key_findings: KeyFinding[];
  claims: ClaimVerification[];
  model_version: string;
  generated_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  node_type: 'SUPPLIER' | 'DIRECTOR' | 'RELATED_ENTITY' | 'ADDRESS' | 'BANK_ACCOUNT';
  color: string;
  size: number;
  [key: string]: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  style?: string;
}

export interface GraphPayload {
  supplier_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    total_nodes: number;
    total_edges: number;
    related_entities_count: number;
    network_signals: Array<{
      type: string;
      severity: string;
      message: string;
      details?: string;
    }>;
  };
}

export interface Citation {
  doc_id: string;
  doc_name: string;
  page: number;
  snippet: string;
}

export interface ChatMessage {
  sender: 'user' | 'analyst';
  text: string;
  citations?: Citation[];
  verification_status?: string;
  claims_verified?: number;
  claims_unsupported?: number;
}

// TypeScript interfaces
