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

export interface RiskVectorDetail {
  score: number | null;
  status: 'computed' | 'insufficient' | 'na';
  evidence_ids: string[];
  reason_codes: string[];
  rule_version: string;
}

export interface RiskBreakdown {
  identity: number | null;
  documents: number | null;
  financial: number | null;
  operational: number | null;
  network: number | null;
  reputation: number | null;
  vectors?: Record<string, RiskVectorDetail>;
}

export interface ConflictSourceDetails {
  document_id?: string;
  document_name?: string;
  page?: number;
  snippet?: string;
  value?: string;
}

export interface KeyFinding {
  id: string;
  severity: 'success' | 'info' | 'warning' | 'danger';
  message: string;
  category: string;
  source_reference?: string;
  page_number?: number;
  conflict_type?: string;
  source_a?: string;
  source_b?: string;
  source_a_details?: ConflictSourceDetails;
  source_b_details?: ConflictSourceDetails;
  similarity_score?: number;
  status?: 'OPEN' | 'REVIEWED' | 'WAIVED';
}

export interface ClaimVerification {
  claim_id: string;
  claim_text: string;
  claim_type: string;
  status: 'SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_EVIDENCE';
  confidence_score: number;
  evidence_snippet?: string;
  source_doc_name?: string;
  evidence_id?: string;
  reviewer_state: 'PENDING' | 'APPROVED' | 'OVERRIDDEN' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE';
}

export interface AnalysisReport {
  analysis_id: string;
  supplier_id: string;
  supplier_name: string;
  assessment_state: 'NOT_ASSESSABLE' | 'PROVISIONAL' | 'ASSESSED';
  evidence_coverage: number;
  assessment_confidence: number;
  provisional_reason?: string | null;
  risk_score: number | null;
  risk_level: 'UNASSESSED' | 'LOW' | 'MEDIUM' | 'HIGH';
  summary: string;
  risk_breakdown: RiskBreakdown;
  key_findings: KeyFinding[];
  claims: ClaimVerification[];
  system_notices?: string[];
  is_evidence_grounded?: boolean;
  model_version: string;
  rule_version?: string;
  generated_at: string;
  data_source: 'UPLOADED_DOCUMENTS' | 'DEMO_FIXTURES' | 'NO_EVIDENCE';
  document_count: number;
}

export interface SupplierAlert {
  severity: 'warning' | 'danger' | 'info' | 'success';
  category: string;
  message: string;
  source_reference?: string;
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
  confidence?: number;
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

export interface AuthUser {
  user_id: string;
  name: string;
  email: string;
  role: 'procurement_officer' | 'reviewer' | 'admin';
  organization: string;
}

// ─── Business features ───────────────────────────────────────────

export interface TenderBid {
  supplier_id: string;
  supplier_name?: string;
  unit_price: number;
  lead_time_days?: number | null;
  risk_score?: number;
  risk_level?: string;
}

export interface RankedBid extends TenderBid {
  rank: number;
  total_price: number | null;
  price_score: number;
  delivery_score: number;
  composite_score: number;
  reasons: string[];
  flags: string[];
}

export interface TenderResult {
  tender_id?: string;
  quantity: number;
  target_unit_price?: number | null;
  deadline_days?: number | null;
  weights: Record<string, number>;
  ranked_bids: RankedBid[];
  recommendation: {
    winner_supplier_id: string;
    winner_supplier_name: string;
    margin_over_runner_up: number | null;
    summary: string;
  };
}

export interface TenderHistoryItem {
  tender_id: string;
  quantity: number;
  deadline_days: number | null;
  created_at: string;
  winner: string | null;
  winner_score: number | null;
  bid_count: number;
}

export interface AnalyticsOverview {
  totals: {
    suppliers: number;
    verified: number;
    flagged: number;
    pending_review: number;
    documents: number;
    analyses_run: number;
  };
  avg_risk: number | null;
  risk_distribution: { LOW: number; MEDIUM: number; HIGH: number };
  vector_averages: Record<string, number | null>;
  expiry_watchlist: Array<{
    supplier_id: string;
    supplier_name: string;
    expiry_date: string;
    days_remaining: number;
    source_document: string;
  }>;
  top_risk_categories: Array<{ category: string; count: number }>;
  claim_health: { total: number; supported: number; support_rate: number | null };
  recent_analyses: Array<{
    supplier_id: string;
    risk_score: number;
    risk_level: string;
    generated_at: string;
  }>;
  generated_at: string;
}

export interface PipelineStage {
  stage: string;
  message: string;
  progress: number;
  report?: AnalysisReport;
}

export interface ExtractedEntityItem {
  id: string;
  document_id: string;
  document_name?: string;
  page_number: number;
  entity_type: string;
  entity_value: string;
  confidence: number;
  snippet?: string;
  bounding_box?: Record<string, any>;
}

export interface PipelineJob {
  job_id: string;
  supplier_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  current_stage: string;
  progress_percent: number;
  stage_timings: Record<string, number>;
  error_message?: string;
  retry_count: number;
  created_at: string;
  completed_at?: string;
}

export interface PortalInvite {
  invite_id: string;
  supplier_id: string;
  supplier_name: string;
  invite_token: string;
  invite_url?: string;
  recipient_email?: string;
  required_documents: string[];
  expires_at: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
}

export interface PortalViewData {
  supplier_name: string;
  required_documents: string[];
  uploaded_documents: Array<{
    document_id: string;
    original_filename: string;
    document_type: string;
    uploaded_at: string;
    page_count?: number;
  }>;
  expires_at: string;
}

export interface TimelineEvent {
  event_id: string;
  supplier_id: string;
  event_type: string;
  title: string;
  details?: string;
  metadata_json?: Record<string, any>;
  actor_email?: string;
  timestamp: string;
}

export interface EvalRunSummary {
  run_id: string;
  executed_at: string;
  metrics: {
    field_extraction: { precision: number; recall: number; f1_score: number };
    conflict_detection: { precision: number; recall: number; f1_score: number };
    claim_verification: {
      per_class: Record<string, { precision: number; recall: number; f1_score: number }>;
      confusion_matrix: Record<string, Record<string, number>>;
    };
  };
  disclaimer: string;
}
