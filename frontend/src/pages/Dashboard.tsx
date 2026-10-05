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
import { Building2, RefreshCw, Plus, Download, FileJson, BellRing, X } from 'lucide-react';

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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Supplier Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#131b2e] border border-[#233252] p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Active Supplier Review</span>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="bg-[#0d1424] border border-[#233252] text-sm font-bold text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Supplier</span>
          </button>
          <button
            onClick={() => api.exportReport(selectedSupplierId, 'html').catch(err => alert(err.message))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#28384f] text-slate-300 text-xs font-semibold border border-[#334155] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
          <button
            onClick={() => api.exportReport(selectedSupplierId, 'json').catch(err => alert(err.message))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#28384f] text-slate-300 text-xs font-semibold border border-[#334155] transition-colors"
          >
            <FileJson className="w-3.5 h-3.5" />
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#28384f] text-slate-300 text-xs font-semibold border border-[#334155] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-run Analysis</span>
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-[#131b2e] border border-[#233252] p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Onboard New Supplier</span>
            <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={newSupplierName}
              onChange={e => setNewSupplierName(e.target.value)}
              placeholder="Legal company name *"
              className="bg-[#0d1424] border border-[#233252] text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 sm:col-span-2"
            />
            <input
              value={newSupplierIndustry}
              onChange={e => setNewSupplierIndustry(e.target.value)}
              placeholder="Industry"
              className="bg-[#0d1424] border border-[#233252] text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>
          {createError && <p className="text-xs text-rose-400">{createError}</p>}
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
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create Supplier Profile'}
          </button>
        </div>
      )}

      {!loading && alerts.length > 0 && (
        <div className="bg-[#131b2e] border border-amber-500/30 p-3.5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <BellRing className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Active Alerts</span>
          </div>
          <ul className="space-y-1.5">
            {alerts.map((a, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${a.severity === 'danger' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <span className={a.severity === 'danger' ? 'text-rose-300' : 'text-amber-200'}>
                  <b>{a.category}:</b> {a.message}
                  {a.source_reference && <span className="text-slate-500"> — {a.source_reference}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span>Evaluating multi-vector risk and verifying evidence...</span>
        </div>
      )}

      {!loading && report && graphData && (
        <>
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Primary Scorecard matching poster sample output */}
              <ScoreCard report={report} />

              {/* 2-Column Section: Risk Breakdown (6 vectors) + Key Findings */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RiskRadar breakdown={report.risk_breakdown} />
                <FindingsList findings={report.key_findings} />
              </div>

              {/* Evidence basis banner */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="font-bold uppercase tracking-wider">Evidence basis:</span>
                <span className={`px-2 py-0.5 rounded font-semibold ${
                  report.data_source === 'UPLOADED_DOCUMENTS' ? 'bg-emerald-500/20 text-emerald-400'
                    : report.data_source === 'DEMO_FIXTURES' ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {report.data_source.replace('_', ' ')}
                </span>
                <span>· {report.document_count} uploaded document(s) on file</span>
              </div>

              {/* AI Analyst Grounded Summary with Claim Verification */}
              <AnalystSummary report={report} onReviewRecorded={() => loadData(selectedSupplierId)} />

              {/* Document Upload Drawer */}
              <DocumentDrawer
                supplierId={selectedSupplierId}
                onUploadSuccess={() => loadData(selectedSupplierId)}
              />
            </div>
          )}

          {activeTab === 'graph' && (
            <GraphViewer graphData={graphData} />
          )}

          {activeTab === 'chat' && (
            <GroundedChat
              supplierId={selectedSupplierId}
              supplierName={report.supplier_name}
            />
          )}

          {activeTab === 'compare' && (
            <SupplierCompare
              suppliers={suppliers}
              onSelectSupplier={(sid) => {
                setSelectedSupplierId(sid);
              }}
            />
          )}
        </>
      )}
    </main>
  );
};

// Dashboard page
