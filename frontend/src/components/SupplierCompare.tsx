import React, { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { Supplier, AnalysisReport } from '../types';
import { api } from '../services/api';

interface SupplierCompareProps {
  suppliers: Supplier[];
  onSelectSupplier: (supplierId: string) => void;
}

export const SupplierCompare: React.FC<SupplierCompareProps> = ({ suppliers, onSelectSupplier }) => {
  const [liveReports, setLiveReports] = useState<Record<string, AnalysisReport>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const loadReport = async (supplierId: string) => {
    if (liveReports[supplierId]) {
      onSelectSupplier(supplierId);
      return;
    }
    setLoadingIds(prev => new Set(prev).add(supplierId));
    try {
      const report = await api.getAnalysisReport(supplierId);
      setLiveReports(prev => ({ ...prev, [supplierId]: report }));
    } catch (err) {
      console.error('Failed to load comparison report:', err);
      onSelectSupplier(supplierId);
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(supplierId);
        return next;
      });
    }
  };

  const rows = suppliers.slice(0, 8);

  const riskBadge = (level?: string) =>
    level === 'LOW' ? 'badge-success'
    : level === 'MEDIUM' ? 'badge-warning'
    : level === 'HIGH' ? 'badge-danger'
    : 'badge-info';

  return (
    <div className="card-premium p-6 space-y-5 animate-rise">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <GitCompare className="w-4 h-4 text-brass-light" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-espresso">Side-by-Side Supplier Comparison</h3>
          <p className="text-[11px] text-stonewarm">Live comparative risk evaluation for procurement tender review</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cream-300">
        <table className="w-full text-left text-xs border-collapse bg-linen">
          <thead>
            <tr className="border-b border-cream-300 text-brown-600 uppercase text-[10px] tracking-[0.14em] bg-cream-200">
              <th className="py-3.5 px-4 font-semibold">Supplier Entity</th>
              <th className="py-3.5 px-4 font-semibold">Trust Score</th>
              <th className="py-3.5 px-4 font-semibold">Risk Level</th>
              <th className="py-3.5 px-4 font-semibold">Industry</th>
              <th className="py-3.5 px-4 font-semibold">Status</th>
              <th className="py-3.5 px-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-300">
            {rows.map((row, idx) => {
              const rep = liveReports[row.supplier_id];
              const isLoading = loadingIds.has(row.supplier_id);
              return (
                <tr key={row.supplier_id} className="hover:bg-cream-100/70 transition-colors animate-fade" style={{ animationDelay: `${idx * 0.04}s` }}>
                  <td className="py-4 px-4">
                    <div className="font-bold text-espresso">{row.name}</div>
                    <div className="text-[11px] text-stonewarm font-mono">{row.supplier_id.slice(0, 13)}…</div>
                  </td>
                  <td className="py-4 px-4 font-mono font-bold text-sm text-espresso">
                    {rep ? `${rep.risk_score}/100` : <span className="text-stonewarm font-sans font-normal">load to fetch</span>}
                  </td>
                  <td className="py-4 px-4">
                    {rep
                      ? <span className={`badge ${riskBadge(rep.risk_level)}`}>{rep.risk_level}</span>
                      : <span className="text-stonewarm">—</span>}
                  </td>
                  <td className="py-4 px-4 text-brown-700">{row.industry}</td>
                  <td className="py-4 px-4">
                    <span className={`badge ${row.status === 'VERIFIED' ? 'badge-success' : row.status === 'FLAGGED' || row.status === 'REJECTED' ? 'badge-danger' : 'badge-info'}`}>
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => loadReport(row.supplier_id)}
                      disabled={isLoading}
                      className="btn-primary !py-1.5 !px-3 !text-[11px]"
                    >
                      {isLoading ? 'Loading…' : rep ? 'View Report' : 'Fetch & View'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-stonewarm">
        Rows load the supplier's latest stored analysis on demand — nothing here is a canned number.
      </p>
    </div>
  );
};
