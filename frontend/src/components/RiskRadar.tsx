import React from 'react';
import { RiskBreakdown } from '../types';

interface RiskRadarProps {
  breakdown: RiskBreakdown;
}

export const RiskRadar: React.FC<RiskRadarProps> = ({ breakdown }) => {
  const vectors = [
    { label: 'Identity', score: breakdown.identity },
    { label: 'Documents', score: breakdown.documents },
    { label: 'Financial', score: breakdown.financial },
    { label: 'Operational', score: breakdown.operational },
    { label: 'Network', score: breakdown.network },
    { label: 'Reputation', score: breakdown.reputation }
  ];

  const barColor = (score: number | null) => {
    if (score === null) return 'bg-sand-300';
    return score >= 80 ? 'bg-gradient-to-r from-olive-500 to-olive-600'
      : score >= 60 ? 'bg-gradient-to-r from-brass to-gold'
      : 'bg-gradient-to-r from-terracotta to-terracotta-deep';
  };

  return (
    <div className="card-premium card-hover p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-semibold text-espresso">Risk Breakdown</h3>
        <span className="badge-info">6 Vectors Analyzed</span>
      </div>

      <div className="space-y-4">
        {vectors.map((vec, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-brown-700 font-medium">{vec.label}</span>
              <span className="font-mono font-bold text-espresso">
                {vec.score !== null ? `${vec.score}/100` : 'Insufficient evidence'}
              </span>
            </div>
            <div className="h-2.5 w-full bg-cream-200 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(62,48,26,0.12)]">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor(vec.score)}`}
                style={{ width: `${vec.score ?? 0}%`, transitionDelay: `${idx * 70}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
