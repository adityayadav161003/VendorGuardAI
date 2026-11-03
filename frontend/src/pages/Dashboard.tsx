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
import { Supplier, AnalysisReport, GraphPayload } from '../types';
import { Building2, RefreshCw } from 'lucide-react';

interface DashboardProps {
  activeTab: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeTab }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('sup-abc-pkg-001');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [graphData, setGraphData] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (supplierId: string) => {
    setLoading(true);
    try {
      const [sups, rep, graph] = await Promise.all([
        api.getSuppliers(),
        api.getAnalysisReport(supplierId),
        api.getRelationshipGraph(supplierId)
      ]);
      setSuppliers(sups);
      setReport(rep);
      setGraphData(graph);
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

        <button
          onClick={() => loadData(selectedSupplierId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] hover:bg-[#28384f] text-slate-300 text-xs font-semibold border border-[#334155] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

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

              {/* AI Analyst Grounded Summary with Claim Verification */}
              <AnalystSummary report={report} />

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
