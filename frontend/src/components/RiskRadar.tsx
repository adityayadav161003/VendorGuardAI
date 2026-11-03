import React from 'react';
import { RiskBreakdown } from '../types';

interface RiskRadarProps {
  breakdown: RiskBreakdown;
}

export const RiskRadar: React.FC<RiskRadarProps> = ({ breakdown }) => {
  const vectors = [
    { label: 'Identity', score: breakdown.identity, color: 'bg-emerald-500' },
    { label: 'Documents', score: breakdown.documents, color: 'bg-emerald-500' },
    { label: 'Financial', score: breakdown.financial, color: 'bg-amber-500' },
    { label: 'Operational', score: breakdown.operational, color: 'bg-emerald-500' },
    { label: 'Network', score: breakdown.network, color: 'bg-amber-500' },
    { label: 'Reputation', score: breakdown.reputation, color: 'bg-amber-500' }
  ];

  return (
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Risk Breakdown</h3>
        <span className="text-xs text-slate-400 font-medium">6 Vectors Analyzed</span>
      </div>

      <div className="space-y-3.5">
        {vectors.map((vec, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">{vec.label}</span>
              <span className="font-mono font-bold text-slate-100">{vec.score}</span>
            </div>
            <div className="h-2.5 w-full bg-[#1e293b] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${vec.color}`}
                style={{ width: `${vec.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 6-vector breakdown
