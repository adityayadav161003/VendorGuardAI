import React, { useEffect, useState, useCallback } from 'react';
import { ScoreCard } from '../components/ScoreCard';
import { RiskRadar } from '../components/RiskRadar';
import { FindingsList } from '../components/FindingsList';
import { AnalystSummary } from '../components/AnalystSummary';
import { DocumentManager } from '../components/DocumentManager';
import { GraphViewer } from '../components/GraphViewer';
import { GroundedChat } from '../components/GroundedChat';
import { SupplierCompare } from '../components/SupplierCompare';
import { MonitoringWatchlist } from '../components/MonitoringWatchlist';
import { CommandCenter } from '../components/CommandCenter';
import { GlobalStatusBar } from '../components/GlobalStatusBar';
import { SupplierActionBar } from '../components/SupplierActionBar';
import { VectorDetailDrawer } from '../components/VectorDetailDrawer';
import { PortalInviteModal } from '../components/PortalInviteModal';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import { api } from '../services/api';
import { Supplier, AnalysisReport, GraphPayload, SupplierAlert } from '../types';
import { Plus, X, Loader2, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';

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

  // Modals & Drawers state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Vector Audit Drawer
  const [auditVectorKey, setAuditVectorKey] = useState<string | null>(null);

  // Onboard form
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierIndustry, setNewSupplierIndustry] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = useCallback(async (supplierId: string) => {
    setLoading(true);
    try {
      const [sups, rep, graph, alrts] = await Promise.all([
        api.getSuppliers(),
        api.getAnalysisReport(supplierId),
        api.getRelationshipGraph(supplierId),
        api.getAlerts(supplierId).catch(() => []),
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
  }, []);

  useEffect(() => {
    loadData(selectedSupplierId);
  }, [selectedSupplierId, loadData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const switcherBtn = document.getElementById('supplier-switcher-btn');
        switcherBtn?.click();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      } else if (e.key === 'r') {
        e.preventDefault();
        loadData(selectedSupplierId);
      } else if (e.key === 'e') {
        e.preventDefault();
        api.exportReport(selectedSupplierId, 'html').catch(err => alert(err.message));
      } else if (e.key === 'j') {
        e.preventDefault();
        const idx = suppliers.findIndex(s => s.supplier_id === selectedSupplierId);
        if (idx !== -1 && idx < suppliers.length - 1) {
          setSelectedSupplierId(suppliers[idx + 1].supplier_id);
        }
      } else if (e.key === 'k') {
        e.preventDefault();
        const idx = suppliers.findIndex(s => s.supplier_id === selectedSupplierId);
        if (idx > 0) {
          setSelectedSupplierId(suppliers[idx - 1].supplier_id);
        }
      } else if (e.key === 'Escape') {
        setShowShortcutsModal(false);
        setShowPortalModal(false);
        setShowCreateForm(false);
        setAuditVectorKey(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [suppliers, selectedSupplierId, loadData]);

  // Get active vector detail for audit drawer
  const activeVectorDetail = report && auditVectorKey
    ? (report.risk_breakdown.vectors ? report.risk_breakdown.vectors[auditVectorKey] : null)
    : null;

  const activeVectorScore = report && auditVectorKey
    ? (report.risk_breakdown as any)[auditVectorKey] ?? report.risk_score
    : null;

  return (
    <div className="space-y-6">
      {/* ── Slim Global Status Bar (replacing repeated banners) ── */}
      <GlobalStatusBar
        alerts={alerts}
        dataSource={report?.data_source}
        isEvidenceGrounded={report?.is_evidence_grounded}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 pb-12">
        {/* ── Sticky Action Bar with Searchable Switcher ───── */}
        <SupplierActionBar
          suppliers={suppliers}
          selectedSupplierId={selectedSupplierId}
          onSelectSupplier={setSelectedSupplierId}
          report={report}
          loading={loading}
          onNewSupplierClick={() => { setShowCreateForm(prev => !prev); setCreateError(null); }}
          onReanalyzeClick={() => loadData(selectedSupplierId)}
          onExport={format => api.exportReport(selectedSupplierId, format).catch(err => alert(err.message))}
          onInvitePortalClick={() => setShowPortalModal(true)}
        />

        {/* ── New Supplier Modal/Form ──────────────────────── */}
        {showCreateForm && (
          <div className="card-premium p-5 space-y-4 animate-scale-in border-brass/50 shadow-card">
            <div className="flex items-center justify-between">
              <span className="section-label">Onboard New Supplier</span>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 text-stonewarm hover:text-espresso transition-colors rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={newSupplierName}
                onChange={e => setNewSupplierName(e.target.value)}
                placeholder="Legal company name *"
                className="input-premium sm:col-span-2 text-xs"
              />
              <input
                value={newSupplierIndustry}
                onChange={e => setNewSupplierIndustry(e.target.value)}
                placeholder="Industry (e.g. Packaging, Steel)"
                className="input-premium text-xs"
              />
            </div>
            {createError && <p className="text-xs text-terracotta-deep font-semibold">{createError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateForm(false)} className="btn-ghost !text-xs">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newSupplierName.trim()) { setCreateError('Supplier name is required'); return; }
                  setCreating(true);
                  setCreateError(null);
                  try {
                    const created = await api.createSupplier({
                      name: newSupplierName.trim(),
                      industry: newSupplierIndustry.trim() || undefined,
                    });
                    setNewSupplierName('');
                    setNewSupplierIndustry('');
                    setShowCreateForm(false);
                    await loadData(created.supplier_id);
                    setSelectedSupplierId(created.supplier_id);
                  } catch (err: any) {
                    setCreateError(err.message || 'Failed to create supplier profile');
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
                className="btn-primary !text-xs"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{creating ? 'Creating Profile…' : 'Create Supplier Profile'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Loading Skeleton (matching real card layout) ─── */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="card-premium p-8 h-48 bg-cream-100/70 border border-cream-250 flex items-center justify-between">
              <div className="space-y-3 w-1/2">
                <div className="h-6 bg-cream-200 rounded-md w-3/4" />
                <div className="h-4 bg-cream-200 rounded-md w-1/2" />
                <div className="h-3 bg-cream-200 rounded-md w-1/3" />
              </div>
              <div className="w-24 h-24 rounded-full bg-cream-200" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-premium p-6 h-64 bg-cream-100/70" />
              <div className="card-premium p-6 h-64 bg-cream-100/70" />
            </div>
          </div>
        )}

        {/* ── Tab Content ──────────────────────────────────── */}
        {!loading && report && graphData && (
          <>
            {/* Tab 1: Overview & Audit */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-fade">
                {/* Screen 3.1: Hero Verdict Banner & Score Ring */}
                <ScoreCard
                  report={report}
                  onOpenVectorAudit={key => setAuditVectorKey(key === 'composite' ? 'identity' : key)}
                />

                {/* Vector Breakdown & Dual-Source Conflicts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="animate-rise" style={{ animationDelay: '0.05s' }}>
                    <RiskRadar
                      breakdown={report.risk_breakdown}
                      onSelectVector={key => setAuditVectorKey(key)}
                    />
                  </div>
                  <div className="animate-rise" style={{ animationDelay: '0.10s' }}>
                    <FindingsList findings={report.key_findings} />
                  </div>
                </div>

                {/* Screen 3.4: Grounded Summary & Claim NLI Deconstruction */}
                <div className="animate-rise" style={{ animationDelay: '0.15s' }}>
                  <AnalystSummary
                    report={report}
                    onReviewRecorded={() => loadData(selectedSupplierId)}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Documents & Pipeline Stepper */}
            {activeTab === 'conflicts_docs' && (
              <div className="space-y-6 animate-fade">
                <DocumentManager
                  supplierId={selectedSupplierId}
                  onUploadSuccess={() => loadData(selectedSupplierId)}
                />
                <FindingsList findings={report.key_findings} />
              </div>
            )}

            {/* Tab 3: Interactive Relationship Graph */}
            {activeTab === 'graph' && (
              <div className="animate-fade">
                <GraphViewer graphData={graphData} />
              </div>
            )}

            {/* Tab 4: AI Grounded Analyst Chat */}
            {activeTab === 'chat' && (
              <div className="animate-fade">
                <GroundedChat
                  supplierId={selectedSupplierId}
                  supplierName={report.supplier_name}
                />
              </div>
            )}

            {/* Tab 5: Side-by-Side Tender Compare */}
            {activeTab === 'compare' && (
              <div className="animate-fade">
                <SupplierCompare
                  suppliers={suppliers}
                  onSelectSupplier={sid => setSelectedSupplierId(sid)}
                />
              </div>
            )}

            {/* Tab 6: Monitoring & Expiry Watchlist */}
            {activeTab === 'monitoring' && (
              <div className="animate-fade">
                <MonitoringWatchlist
                  supplierId={selectedSupplierId}
                  supplierName={report.supplier_name}
                />
              </div>
            )}

            {/* Tab 7: Portfolio Intel */}
            {activeTab === 'portfolio' && (
              <div className="animate-fade">
                <CommandCenter />
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Vector Detail Audit Drawer ─────────────────────── */}
      <VectorDetailDrawer
        isOpen={!!auditVectorKey}
        onClose={() => setAuditVectorKey(null)}
        vectorName={auditVectorKey || ''}
        detail={activeVectorDetail}
        score={activeVectorScore}
      />

      {/* ── Portal Invite Modal ────────────────────────────── */}
      <PortalInviteModal
        isOpen={showPortalModal}
        onClose={() => setShowPortalModal(false)}
        supplierId={selectedSupplierId}
        supplierName={report?.supplier_name || 'Active Supplier'}
      />

      {/* ── Keyboard Shortcuts Modal ───────────────────────── */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
};
