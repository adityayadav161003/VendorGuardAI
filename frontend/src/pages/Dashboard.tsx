import React, { useEffect, useState } from 'react';
import { ScoreCard } from '../components/ScoreCard';
import { RiskRadar } from '../components/RiskRadar';
import { FindingsList } from '../components/FindingsList';
import { AnalystSummary } from '../components/AnalystSummary';
import { GraphViewer } from '../components/GraphViewer';
import { GroundedChat } from '../components/GroundedChat';
import { SupplierCompare } from '../components/SupplierCompare';
import { DocumentDrawer } from '../components/DocumentDrawer';
import { api } from '../services/api';
import { Supplier, AnalysisReport, GraphPayload, SupplierAlert } from '../types';
import { Building2, RefreshCw, Plus, Download, FileJson, BellRing, X, Loader2 } from 'lucide-react';

interface DashboardProps {
  activeTab: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeTab }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('sup-abc-pkg-001');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [graphData, setGraphData] = useState<GraphPayload | null>(null);
  const [alerts, setAlerts] = useState<SupplierAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierIndustry, setNewSupplierIndustry] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async (supplierId: string) => {
    setLoading(true);
    try {
      const [sups, rep, graph, alrts] = await Promise.all([
        api.getSuppliers(),
        api.getAnalysisReport(supplierId),
        api.getRelationshipGraph(supplierId),
        api.getAlerts(supplierId).catch(() => [])
      ]);
      setSuppliers(sups);
      setReport(rep);
      setGraphData(graph);
      setAlerts(alrts);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedSupplierId);
  }, [selectedSupplierId]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ── Supplier selector bar ─────────────────────────── */}
      <div className="card-premium animate-rise p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-olive-700 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_14px_-6px_rgba(60,69,37,0.6)]">
            <Building2 className="w-5 h-5 text-cream-100" />
          </div>
          <div>
            <span className="section-label">Active Supplier Review</span>
            <div className="mt-1.5">
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="input-premium !py-2 !px-3 text-sm font-semibold min-w-[260px] cursor-pointer"
              >
                {suppliers.map(s => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.name} ({s.business_type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(null); }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>New Supplier</span>
          </button>
          <button
            onClick={() => api.exportReport(selectedSupplierId, 'html').catch(err => alert(err.message))}
            className="btn-ghost"
          >
            <Download className="w-4 h-4" />
            <span>Export Report</span>
          </button>
          <button
            onClick={() => api.exportReport(selectedSupplierId, 'json').catch(err => alert(err.message))}
            className="btn-ghost"
          >
            <FileJson className="w-4 h-4" />
            <span>JSON</span>
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              try {
                await api.reanalyze(selectedSupplierId);
              } catch (err: any) {
                console.error('Re-analysis failed:', err);
              }
              await loadData(selectedSupplierId);
            }}
            className="btn-brass"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-run Analysis</span>
          </button>
        </div>
      </div>

      {/* ── New supplier form ─────────────────────────────── */}
      {showCreateForm && (
        <div className="card-premium p-5 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between">
            <span className="section-label">Onboard New Supplier</span>
            <button onClick={() => setShowCreateForm(false)} className="p-1 text-stonewarm hover:text-espresso transition-colors rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              placeholder="Legal company name *"
              className="input-premium sm:col-span-2"
            />
            <input
              value={newSupplierIndustry}
              onChange={e => setNewSupplierIndustry(e.target.value)}
              placeholder="Industry"
              className="input-premium"
            />
          </div>
          {createError && <p className="text-xs text-terracotta-deep">{createError}</p>}
          <button
            onClick={async () => {
              if (!newSupplierName.trim()) { setCreateError('Supplier name is required'); return; }
              setCreating(true);
              setCreateError(null);
              try {
                const created = await api.createSupplier({
                  name: newSupplierName.trim(),
                  industry: newSupplierIndustry.trim() || undefined
                });
                setNewSupplierName('');
                setNewSupplierIndustry('');
                setShowCreateForm(false);
                await loadData(created.supplier_id);
                setSelectedSupplierId(created.supplier_id);
              } catch (err: any) {
                setCreateError(err.message || 'Failed to create supplier');
              } finally {
                setCreating(false);
              }
            }}
            disabled={creating}
            className="btn-primary"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? 'Creating...' : 'Create Supplier Profile'}
          </button>
        </div>
      )}

      {/* ── Alerts ────────────────────────────────────────── */}
      {!loading && alerts.length > 0 && (
        <div className="card-premium border-brass/50 animate-rise p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-8 h-8 rounded-lg bg-[#F3E7C9] border border-brass/40 flex items-center justify-center">
              <BellRing className="w-4 h-4 text-gold-deep" />
            </span>
            <span className="section-label !text-gold-deep">Active Alerts</span>
          </div>
          <ul className="space-y-2">
            {alerts.map((a, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-[13px] p-2.5 rounded-xl border animate-fade"
                style={{
                  animationDelay: `${idx * 0.06}s`,
                  borderColor: a.severity === 'danger' ? 'rgba(176,86,58,0.35)' : 'rgba(185,151,91,0.4)',
                  background: a.severity === 'danger' ? 'rgba(176,86,58,0.06)' : 'rgba(185,151,91,0.08)',
                }}
              >
                <span className={`mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full ${a.severity === 'danger' ? 'bg-terracotta' : 'bg-gold'}`} />
                <span className={a.severity === 'danger' ? 'text-terracotta-deep' : 'text-gold-deep'}>
                  <b className="font-semibold">{a.category}:</b> {a.message}
                  {a.source_reference && <span className="text-stonewarm"> — {a.source_reference}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Loading state ─────────────────────────────────── */}
      {loading && (
        <div className="card-premium py-24 flex flex-col items-center justify-center gap-4 text-brown-600 text-sm animate-fade">
          <RefreshCw className="w-6 h-6 animate-spin text-olive-600" />
          <span className="font-display italic text-lg text-espresso">Evaluating multi-vector risk and verifying evidence…</span>
          <span className="text-xs text-stonewarm">Cross-checking registries, consistency rules and network signals</span>
        </div>
      )}

      {/* ── Tab content ───────────────────────────────────── */}
      {!loading && report && graphData && (
        <>
          {activeTab === 'dashboard' && (
            <div key="dashboard" className="space-y-6 animate-fade">
              <ScoreCard report={report} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="animate-rise" style={{ animationDelay: '0.08s' }}>
                  <RiskRadar breakdown={report.risk_breakdown} />
                </div>
                <div className="animate-rise" style={{ animationDelay: '0.16s' }}>
                  <FindingsList findings={report.key_findings} />
                </div>
              </div>

              {/* Evidence basis */}
              <div className="flex items-center gap-2.5 text-xs animate-rise" style={{ animationDelay: '0.22s' }}>
                <span className="section-label">Evidence basis</span>
                <span className={`badge ${
                  report.data_source === 'UPLOADED_DOCUMENTS' ? 'badge-success'
                    : report.data_source === 'DEMO_FIXTURES' ? 'badge-info'
                    : 'badge-danger'
                }`}>
                  {report.data_source.replace('_', ' ')}
                </span>
                <span className="text-stonewarm">· {report.document_count} uploaded document(s) on file</span>
              </div>

              <div className="animate-rise" style={{ animationDelay: '0.26s' }}>
                <AnalystSummary report={report} onReviewRecorded={() => loadData(selectedSupplierId)} />
              </div>

              <div className="animate-rise" style={{ animationDelay: '0.32s' }}>
                <DocumentDrawer
                  supplierId={selectedSupplierId}
                  onUploadSuccess={() => loadData(selectedSupplierId)}
                />
              </div>
            </div>
          )}

          {activeTab === 'graph' && (
            <div key="graph" className="animate-fade">
              <GraphViewer graphData={graphData} />
            </div>
          )}

          {activeTab === 'chat' && (
            <div key="chat" className="animate-fade">
              <GroundedChat
                supplierId={selectedSupplierId}
                supplierName={report.supplier_name}
              />
            </div>
          )}

          {activeTab === 'compare' && (
            <div key="compare" className="animate-fade">
              <SupplierCompare
                suppliers={suppliers}
                onSelectSupplier={(sid) => {
                  setSelectedSupplierId(sid);
                }}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
};
