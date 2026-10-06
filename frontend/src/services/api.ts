import {
  Supplier,
  AnalysisReport,
  GraphPayload,
  SupplierAlert,
  AuthUser,
  TenderResult,
  TenderHistoryItem,
  AnalyticsOverview,
  PipelineStage,
  ExtractedEntityItem,
  PipelineJob,
  PortalInvite,
  PortalViewData,
  TimelineEvent,
  EvalRunSummary,
} from '../types';

const API_BASE = '/api';

const TOKEN_KEY = 'vendorguard_token';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handle(res: Response): Promise<Response> {
  if (res.status === 401 && onUnauthorized) {
    localStorage.removeItem(TOKEN_KEY);
    onUnauthorized();
    throw new Error('Your session has expired. Please log in again.');
  }
  return res;
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || fallback;
  } catch {
    return fallback;
  }
}

interface ClaimReviewResult {
  claim_id: string;
  reviewer_state: string;
}

export const api = {
  // ---------------- auth ----------------
  async login(email: string, password: string): Promise<{ access_token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await errorDetail(res, 'Login failed'));
    return res.json();
  },

  async register(name: string, email: string, password: string, organization?: string): Promise<{ access_token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, organization })
    });
    if (!res.ok) throw new Error(await errorDetail(res, 'Registration failed'));
    return res.json();
  },

  async getMe(): Promise<AuthUser> {
    const res = await handle(await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Session invalid');
    return res.json();
  },

  // ---------------- suppliers ----------------
  async getSuppliers(): Promise<Supplier[]> {
    const res = await handle(await fetch(`${API_BASE}/suppliers`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  async getSupplier(supplierId: string): Promise<Supplier> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Failed to fetch supplier details');
    return res.json();
  },

  async createSupplier(payload: { name: string; business_type?: string; industry?: string; website?: string; address?: string }): Promise<Supplier> {
    const res = await handle(await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to create supplier'));
    return res.json();
  },

  async updateSupplier(supplierId: string, payload: Partial<Supplier>): Promise<Supplier> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to update supplier'));
    return res.json();
  },

  // ---------------- analysis ----------------
  async getAnalysisReport(supplierId: string): Promise<AnalysisReport> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/report`, { headers: authHeaders() }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to fetch analysis report'));
    return res.json();
  },

  async getRelationshipGraph(supplierId: string): Promise<GraphPayload> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/graph`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Failed to fetch relationship graph');
    return res.json();
  },

  async getAlerts(supplierId: string): Promise<SupplierAlert[]> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/alerts`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async reanalyze(supplierId: string): Promise<AnalysisReport> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/analyze`, {
      method: 'POST',
      headers: authHeaders()
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to run analysis'));
    return res.json();
  },

  async exportReport(supplierId: string, format: 'html' | 'json'): Promise<void> {
    // Authenticated download: fetch as blob (an <a href> cannot carry the JWT header)
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/report/export?format=${format}`, { headers: authHeaders() }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Export failed'));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = format === 'json'
      ? `vendorguard-report-${supplierId}.json`
      : `vendorguard-report-${supplierId}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  // ---------------- documents ----------------
  async uploadDocument(supplierId: string, docType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('document_type', docType);
    formData.append('file', file);

    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/documents`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Upload failed'));
    return res.json();
  },

  // ---------------- claims & review ----------------
  async reviewClaim(claimId: string, action: 'APPROVED' | 'OVERRIDDEN' | 'REJECTED', comment?: string): Promise<ClaimReviewResult> {
    const res = await handle(await fetch(`${API_BASE}/claims/${claimId}/review`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action, comment })
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to record review'));
    return res.json();
  },

  // ---------------- tender award engine ----------------
  async evaluateTender(payload: {
    quantity: number;
    target_unit_price?: number;
    deadline_days?: number;
    bids: Array<{ supplier_id: string; unit_price: number; lead_time_days?: number }>;
  }): Promise<TenderResult> {
    const res = await handle(await fetch(`${API_BASE}/tenders/evaluate`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Tender evaluation failed'));
    return res.json();
  },

  async getTenderHistory(): Promise<TenderHistoryItem[]> {
    const res = await handle(await fetch(`${API_BASE}/tenders`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Failed to fetch tender history');
    return res.json();
  },

  // ---------------- analytics ----------------
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const res = await handle(await fetch(`${API_BASE}/analytics/overview`, { headers: authHeaders() }));
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  // ---------------- live analysis pipeline (SSE) ----------------
  async *streamAnalysis(supplierId: string): AsyncGenerator<PipelineStage> {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}/analyze/stream`, {
      headers: authHeaders()
    });
    if (res.status === 401 && onUnauthorized) {
      localStorage.removeItem(TOKEN_KEY);
      onUnauthorized();
      throw new Error('Your session has expired. Please log in again.');
    }
    if (!res.ok || !res.body) throw new Error(await errorDetail(res, 'Failed to start live analysis'));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const evt of events) {
        for (const line of evt.split('\n')) {
          if (line.startsWith('data: ') && line.length > 10) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.stage && parsed.stage !== 'open') yield parsed as PipelineStage;
            } catch { /* partial chunk */ }
          }
        }
      }
    }
  },

  // ---------------- chat ----------------
  async askAnalyst(supplierId: string, question: string): Promise<any> {
    const res = await handle(await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ supplier_id: supplierId, question })
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to send question to AI analyst'));
    return res.json();
  },

  // ---------------- compare suppliers ----------------
  async compareSuppliers(supplierIds: string[]): Promise<{ comparisons: AnalysisReport[] }> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/compare`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ supplier_ids: supplierIds })
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to compare suppliers'));
    return res.json();
  },

  // ---------------- extracted entities ----------------
  async getExtractedEntities(supplierId: string): Promise<ExtractedEntityItem[]> {
    const res = await handle(await fetch(`${API_BASE}/suppliers/${supplierId}/extracted-entities`, {
      headers: authHeaders()
    }));
    if (!res.ok) return [];
    return res.json();
  },

  // ---------------- async pipeline jobs ----------------
  async startPipelineJob(supplierId: string): Promise<PipelineJob> {
    const res = await handle(await fetch(`${API_BASE}/pipeline/start/${supplierId}`, {
      method: 'POST',
      headers: authHeaders()
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to start pipeline job'));
    return res.json();
  },

  async getPipelineJob(jobId: string): Promise<PipelineJob> {
    const res = await handle(await fetch(`${API_BASE}/pipeline/jobs/${jobId}`, {
      headers: authHeaders()
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to fetch pipeline status'));
    return res.json();
  },

  async retryPipelineJob(jobId: string): Promise<PipelineJob> {
    const res = await handle(await fetch(`${API_BASE}/pipeline/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: authHeaders()
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to retry pipeline job'));
    return res.json();
  },

  // ---------------- supplier self-service portal ----------------
  async createPortalInvite(supplierId: string, payload: { recipient_email?: string; required_documents?: string[]; expires_in_days?: number }): Promise<PortalInvite> {
    const res = await handle(await fetch(`${API_BASE}/portal/invites`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ supplier_id: supplierId, ...payload })
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to create portal invite'));
    return res.json();
  },

  async getPortalInvites(supplierId: string): Promise<PortalInvite[]> {
    const res = await handle(await fetch(`${API_BASE}/portal/invites/${supplierId}`, {
      headers: authHeaders()
    }));
    if (!res.ok) return [];
    return res.json();
  },

  async getPortalView(token: string): Promise<PortalViewData> {
    const res = await fetch(`${API_BASE}/portal/view/${token}`);
    if (!res.ok) throw new Error(await errorDetail(res, 'Invalid or expired portal link'));
    return res.json();
  },

  async uploadPortalDocument(token: string, docType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('document_type', docType);
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/portal/upload/${token}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error(await errorDetail(res, 'Portal upload failed'));
    return res.json();
  },

  // ---------------- monitoring & timeline ----------------
  async getMonitoringAlerts(supplierId: string): Promise<any> {
    const res = await handle(await fetch(`${API_BASE}/monitoring/alerts/${supplierId}`, {
      headers: authHeaders()
    }));
    if (!res.ok) return { alerts: [] };
    return res.json();
  },

  async getSupplierTimeline(supplierId: string): Promise<TimelineEvent[]> {
    const res = await handle(await fetch(`${API_BASE}/monitoring/timeline/${supplierId}`, {
      headers: authHeaders()
    }));
    if (!res.ok) return [];
    return res.json();
  },

  async triggerSupplierRecheck(supplierId: string): Promise<any> {
    const res = await handle(await fetch(`${API_BASE}/monitoring/recheck/${supplierId}`, {
      method: 'POST',
      headers: authHeaders()
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Re-check failed'));
    return res.json();
  },

  // ---------------- evaluation benchmark ----------------
  async runEvalBenchmark(): Promise<EvalRunSummary> {
    const res = await handle(await fetch(`${API_BASE}/eval/run`, {
      method: 'POST',
      headers: authHeaders()
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Benchmark run failed'));
    return res.json();
  },

  async getEvalRuns(): Promise<any[]> {
    const res = await handle(await fetch(`${API_BASE}/eval/runs`, {
      headers: authHeaders()
    }));
    if (!res.ok) return [];
    return res.json();
  }
};
