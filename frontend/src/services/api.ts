import { Supplier, AnalysisReport, GraphPayload, ChatMessage } from '../types';

const API_BASE = '/api';

export const api = {
  async getSuppliers(): Promise<Supplier[]> {
    const res = await fetch(`${API_BASE}/suppliers`);
    if (!res.ok) throw new Error('Failed to fetch suppliers');
    return res.json();
  },

  async getSupplier(supplierId: string): Promise<Supplier> {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}`);
    if (!res.ok) throw new Error('Failed to fetch supplier details');
    return res.json();
  },

  async getAnalysisReport(supplierId: string): Promise<AnalysisReport> {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}/report`);
    if (!res.ok) throw new Error('Failed to fetch analysis report');
    return res.json();
  },

  async getRelationshipGraph(supplierId: string): Promise<GraphPayload> {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}/graph`);
    if (!res.ok) throw new Error('Failed to fetch relationship graph');
    return res.json();
  },

  async askAnalyst(supplierId: string, question: string): Promise<any> {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_id: supplierId, question })
    });
    if (!res.ok) throw new Error('Failed to send question to AI analyst');
    return res.json();
  },

  async uploadDocument(supplierId: string, docType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('document_type', docType);
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/suppliers/${supplierId}/documents`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  }
};

// API service client
