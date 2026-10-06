import React, { useState } from 'react';
import { GitCompare, CheckCircle2, AlertTriangle, AlertOctagon, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { Supplier, AnalysisReport } from '../types';
import { api } from '../services/api';

interface SupplierCompareProps {
  suppliers: Supplier[];
  onSelectSupplier: (supplierId: string) => void;
}

export const SupplierCompare: React.FC<SupplierCompareProps> = ({ suppliers, onSelectSupplier }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    suppliers.slice(0, 3).map(s => s.supplier_id)
  );
  const [comparisons, setComparisons] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSelectSupplier = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleRunComparison = async () => {
    if (selectedIds.length < 2) {
      setError('Please select at least 2 suppliers to compare.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.compareSuppliers(selectedIds);
      setComparisons(res.comparisons);
    } catch (err: any) {
      setError(err.message || 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  const riskBadge = (level?: string) =>
    level === 'LOW' ? 'badge-success'
    : level === 'MEDIUM' ? 'badge-warning'
    : level === 'HIGH' ? 'badge-danger'
    : 'badge-info';

  return (
    <div className="card-premium p-6 space-y-6 animate-rise shadow-panel">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-espresso flex items-center justify-center text-brass-light shadow-panel">
            <GitCompare className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              Tender Evaluation & Side-by-Side Comparison
            </h3>
            <p className="text-[11px] text-stonewarm">
              Select 2 to 5 suppliers for multi-vector comparative risk evaluation
            </p>
          </div>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={loading || selectedIds.length < 2}
          className="btn-primary !py-2 !px-4 !text-xs flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          <span>Compare Selected ({selectedIds.length})</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-[#F6E3DA] border border-terracotta/40 text-xs text-terracotta-deep">
          {error}
        </div>
      )}

      {/* ── Supplier Selector Checkbox Grid ────────────────── */}
      <div className="p-4 rounded-xl bg-cream-100 border border-cream-300 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="section-label">Select 2 to 5 Suppliers for Comparison:</span>
          <span className="font-mono text-[11px] text-stonewarm">
            {selectedIds.length} / 5 selected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {suppliers.map(s => {
            const isSelected = selectedIds.includes(s.supplier_id);
            return (
              <label
                key={s.supplier_id}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'border-olive-500 bg-olive-50 text-olive-900 font-semibold shadow-xs'
                    : 'border-cream-300 bg-linen hover:bg-cream-150 text-espresso'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectSupplier(s.supplier_id)}
                    className="accent-olive-700 rounded"
                  />
                  <span className="truncate">{s.name}</span>
                </div>
                <span className="text-[10px] text-stonewarm uppercase font-mono ml-1">
                  {s.business_type}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Comparison Table ──────────────────────────────── */}
      {comparisons.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-cream-300 shadow-panel">
          <table className="w-full text-left text-xs border-collapse bg-linen">
            <thead>
              <tr className="border-b border-cream-300 bg-cream-200 text-brown-700 uppercase text-[10.5px] tracking-wide">
                <th className="py-3 px-4 font-semibold">Metric / Vector</th>
                {comparisons.map(rep => (
                  <th key={rep.supplier_id} className="py-3 px-4 font-semibold min-w-[180px]">
                    <div className="font-bold text-espresso text-xs">{rep.supplier_name}</div>
                    <div className="text-[10px] text-stonewarm font-mono lowercase">
                      {rep.supplier_id.slice(0, 16)}…
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-300">
              {/* Row 1: State & Risk Level */}
              <tr className="hover:bg-cream-100/60">
                <td className="py-3 px-4 font-semibold text-espresso">Assessment State</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-3 px-4">
                    <span className={`badge !text-[10px] ${
                      rep.assessment_state === 'ASSESSED' ? 'badge-success'
                      : rep.assessment_state === 'PROVISIONAL' ? 'badge-warning'
                      : 'badge-danger'
                    }`}>
                      {rep.assessment_state}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 2: Composite Score */}
              <tr className="hover:bg-cream-100/60 bg-cream-50/50">
                <td className="py-3 px-4 font-semibold text-espresso">Composite Trust Score</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-3 px-4 font-mono font-bold text-sm text-espresso">
                    {rep.risk_score !== null ? `${rep.risk_score}/100` : <span className="text-stonewarm font-normal">N/A</span>}
                    <span className={`ml-2 badge !text-[9px] ${riskBadge(rep.risk_level)}`}>
                      {rep.risk_level}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Row 3: Confidence & Coverage */}
              <tr className="hover:bg-cream-100/60">
                <td className="py-3 px-4 font-semibold text-espresso">Coverage & Confidence</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-3 px-4 text-brown-700">
                    <div>Coverage: <strong>{rep.evidence_coverage}%</strong></div>
                    <div className="text-[10.5px] text-stonewarm">Confidence: {rep.assessment_confidence}%</div>
                  </td>
                ))}
              </tr>

              {/* Row 4-9: The 6 Vectors */}
              <tr className="hover:bg-cream-100/60">
                <td className="py-2.5 px-4 font-medium text-brown-800">1. Identity Vector</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-2.5 px-4 font-mono">
                    {rep.risk_breakdown.identity !== null ? `${rep.risk_breakdown.identity}/100` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-cream-100/60">
                <td className="py-2.5 px-4 font-medium text-brown-800">2. Documents Vector</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-2.5 px-4 font-mono">
                    {rep.risk_breakdown.documents !== null ? `${rep.risk_breakdown.documents}/100` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-cream-100/60">
                <td className="py-2.5 px-4 font-medium text-brown-800">3. Financial Vector</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-2.5 px-4 font-mono">
                    {rep.risk_breakdown.financial !== null ? `${rep.risk_breakdown.financial}/100` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-cream-100/60">
                <td className="py-2.5 px-4 font-medium text-brown-800">4. Operational Vector</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-2.5 px-4 font-mono">
                    {rep.risk_breakdown.operational !== null ? `${rep.risk_breakdown.operational}/100` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-cream-100/60">
                <td className="py-2.5 px-4 font-medium text-brown-800">5. Network Vector</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-2.5 px-4 font-mono">
                    {rep.risk_breakdown.network !== null ? `${rep.risk_breakdown.network}/100` : '—'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-cream-100/60">
                <td className="py-2.5 px-4 font-medium text-brown-800">6. Reputation Vector</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-2.5 px-4 font-mono">
                    {rep.risk_breakdown.reputation !== null ? `${rep.risk_breakdown.reputation}/100` : '—'}
                  </td>
                ))}
              </tr>

              {/* Row 10: Critical Issues Count */}
              <tr className="hover:bg-cream-100/60 bg-cream-50/50">
                <td className="py-3 px-4 font-semibold text-espresso">Critical Flags & Conflicts</td>
                {comparisons.map(rep => {
                  const dangerCount = rep.key_findings.filter(f => f.severity === 'danger').length;
                  const warningCount = rep.key_findings.filter(f => f.severity === 'warning').length;
                  return (
                    <td key={rep.supplier_id} className="py-3 px-4">
                      {dangerCount > 0 && <span className="badge-danger mr-1">{dangerCount} critical</span>}
                      {warningCount > 0 && <span className="badge-warning">{warningCount} warnings</span>}
                      {dangerCount === 0 && warningCount === 0 && (
                        <span className="badge-success">0 discrepancies</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row 11: Action */}
              <tr className="hover:bg-cream-100/60">
                <td className="py-3 px-4 font-semibold text-espresso">Open Profile</td>
                {comparisons.map(rep => (
                  <td key={rep.supplier_id} className="py-3 px-4">
                    <button
                      onClick={() => onSelectSupplier(rep.supplier_id)}
                      className="btn-primary !py-1 !px-2.5 !text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Dossier</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
