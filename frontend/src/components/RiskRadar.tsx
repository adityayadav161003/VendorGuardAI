import React from 'react';
import { ChevronRight, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';
import { RiskBreakdown } from '../types';

interface RiskRadarProps {
  breakdown: RiskBreakdown;
  onSelectVector?: (vectorKey: string) => void;
}

export const RiskRadar: React.FC<RiskRadarProps> = ({ breakdown, onSelectVector }) => {
  const vectors = [
    { key: 'identity', label: 'Identity Vector', score: breakdown.identity },
    { key: 'documents', label: 'Documents Vector', score: breakdown.documents },
    { key: 'financial', label: 'Financial Vector', score: breakdown.financial },
    { key: 'operational', label: 'Operational Vector', score: breakdown.operational },
    { key: 'network', label: 'Network Vector', score: breakdown.network },
    { key: 'reputation', label: 'Reputation Vector', score: breakdown.reputation },
  ];

  const barColor = (score: number | null) => {
    if (score === null) return 'bg-sand-300';
    return score >= 80 ? 'bg-gradient-to-r from-olive-500 to-olive-600'
      : score >= 60 ? 'bg-gradient-to-r from-brass to-gold'
      : 'bg-gradient-to-r from-terracotta to-terracotta-deep';
  };

  return (
    <div className="card-premium card-hover p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg font-semibold text-espresso">Six-Vector Trust Radar</h3>
          <span className="badge-info">Click vector to audit rules</span>
        </div>
        <p className="text-[11px] text-stonewarm mb-4">
          Scores are derived purely from stored document evidence. Missing vectors are marked insufficient
          and excluded from the composite average.
        </p>

        <div className="space-y-3.5">
          {vectors.map((vec, idx) => {
            const isClickable = !!onSelectVector;
            return (
              <div
                key={idx}
                onClick={() => onSelectVector?.(vec.key)}
                className={`p-2.5 rounded-xl border border-cream-200 transition-all duration-200 ${
                  isClickable ? 'cursor-pointer hover:bg-cream-100 hover:border-olive-400 hover:shadow-xs' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {vec.score !== null ? (
                      vec.score >= 80 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sage-deep" />
                      ) : vec.score >= 60 ? (
                        <AlertCircle className="w-3.5 h-3.5 text-gold-deep" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-terracotta-deep" />
                      )
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-sand-400 bg-sand-200 flex items-center justify-center text-[9px] text-brown-600">
                        ?
                      </span>
                    )}
                    <span className="text-brown-800 font-semibold">{vec.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-espresso">
                      {vec.score !== null ? `${vec.score}/100` : 'Insufficient'}
                    </span>
                    {isClickable && <ChevronRight className="w-3.5 h-3.5 text-stonewarm" />}
                  </div>
                </div>

                <div className="h-2 w-full bg-cream-200 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(62,48,26,0.12)]">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor(vec.score)}`}
                    style={{ width: `${vec.score ?? 0}%`, transitionDelay: `${idx * 60}ms` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-cream-300 flex items-center justify-between text-[11px] text-stonewarm">
        <span>Rule engine: v2.0.0-trust-core</span>
        <span className="text-olive-800 font-medium">Click any vector for audit lineage</span>
      </div>
    </div>
  );
};
