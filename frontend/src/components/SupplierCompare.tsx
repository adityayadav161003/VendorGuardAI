import React, { useState } from 'react';
import { GitCompare, ShieldCheck, AlertTriangle, AlertOctagon, Check } from 'lucide-react';
import { Supplier, AnalysisReport } from '../types';

interface SupplierCompareProps {
  suppliers: Supplier[];
  onSelectSupplier: (supplierId: string) => void;
}

export const SupplierCompare: React.FC<SupplierCompareProps> = ({ suppliers, onSelectSupplier }) => {
  const comparisonData = [
    {
      id: 'sup-abc-pkg-001',
      name: 'ABC Packaging Pvt Ltd',
      industry: 'Packaging & Boxes',
      score: 72,
      risk: 'MEDIUM',
      gst: 'Verified',
      bankStatus: 'Mismatch Flagged',
      isoStatus: 'Expiring in 47d',
      networkStatus: 'Shared Director (2 Co)',
      recommendation: 'Manual Review'
    },
    {
      id: 'sup-zenith-002',
      name: 'Zenith Precision Components',
      industry: 'Machinery & Tools',
      score: 91,
      risk: 'LOW',
      gst: 'Verified',
      bankStatus: 'Exact Match',
      isoStatus: 'Valid (2+ Yrs)',
      networkStatus: 'Clean Network',
      recommendation: 'Auto-Approve PO'
    },
    {
      id: 'sup-shell-003',
      name: 'Apex Shell Trade Ventures',
      industry: 'General Trading',
      score: 34,
      risk: 'HIGH',
      gst: 'PAN Inconsistent',
      bankStatus: 'Savings Account',
      isoStatus: 'Missing',
      networkStatus: 'Shell Ring (5 Co)',
      recommendation: 'Reject & Flag'
    }
  ];

  return (
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Side-by-Side Supplier Comparison
            </h3>
            <p className="text-[11px] text-slate-400">Comparative Risk Evaluation for Procurement Tender</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#233252] text-slate-400 uppercase text-[10px] tracking-wider bg-[#0d1424]">
              <th className="py-3 px-4">Supplier Entity</th>
              <th className="py-3 px-4">Trust Score</th>
              <th className="py-3 px-4">Risk Level</th>
              <th className="py-3 px-4">GST / Tax</th>
              <th className="py-3 px-4">Bank Verification</th>
              <th className="py-3 px-4">Compliance / ISO</th>
              <th className="py-3 px-4">Network Signals</th>
              <th className="py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {comparisonData.map((row) => (
              <tr key={row.id} className="hover:bg-[#1a243d] transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-bold text-white">{row.name}</div>
                  <div className="text-[11px] text-slate-400">{row.industry}</div>
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-sm text-slate-200">
                  {row.score}/100
                </td>
                <td className="py-3.5 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    row.risk === 'LOW' ? 'bg-emerald-500/20 text-emerald-400' :
                    row.risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-rose-500/20 text-rose-400'
                  }`}>
                    {row.risk}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-300">{row.gst}</td>
                <td className="py-3.5 px-4">
                  <span className={row.bankStatus.includes('Mismatch') ? 'text-amber-400 font-medium' : row.bankStatus.includes('Savings') ? 'text-rose-400 font-medium' : 'text-slate-300'}>
                    {row.bankStatus}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-300">{row.isoStatus}</td>
                <td className="py-3.5 px-4">
                  <span className={row.networkStatus.includes('Shell') ? 'text-rose-400 font-semibold' : row.networkStatus.includes('Shared') ? 'text-amber-400 font-medium' : 'text-emerald-400'}>
                    {row.networkStatus}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => onSelectSupplier(row.id)}
                    className="px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all font-medium text-[11px]"
                  >
                    View Report
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Supplier comparison
