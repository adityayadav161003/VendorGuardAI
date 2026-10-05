import { Supplier, AnalysisReport, GraphPayload, SupplierAlert, AuthUser } from '../types';

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

  // ---------------- chat ----------------
  async askAnalyst(supplierId: string, question: string): Promise<any> {
    const res = await handle(await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ supplier_id: supplierId, question })
    }));
    if (!res.ok) throw new Error(await errorDetail(res, 'Failed to send question to AI analyst'));
    return res.json();
  }
};
