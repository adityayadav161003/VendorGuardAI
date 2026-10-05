import React, { ReactElement } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { KeyFinding } from '../types';

interface FindingsListProps {
  findings: KeyFinding[];
}

const STYLES: Record<string, { icon: ReactElement; wrap: string }> = {
  success: {
    icon: <CheckCircle2 className="w-4 h-4 text-sage-deep shrink-0 mt-0.5" />,
    wrap: 'border-olive-300/70 bg-olive-50',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-gold-deep shrink-0 mt-0.5" />,
    wrap: 'border-brass/45 bg-[#F5ECD6]',
  },
  danger: {
    icon: <AlertOctagon className="w-4 h-4 text-terracotta-deep shrink-0 mt-0.5" />,
    wrap: 'border-terracotta/40 bg-[#F6E3DA]',
  },
  info: {
    icon: <Info className="w-4 h-4 text-stonewarm shrink-0 mt-0.5" />,
    wrap: 'border-cream-400 bg-cream-200/60',
  },
};

export const FindingsList: React.FC<FindingsListProps> = ({ findings }) => {
  return (
    <div className="card-premium card-hover p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-lg font-semibold text-espresso">Key Findings</h3>
        <span className="badge-info">Cross-Doc & Registry Evidence</span>
      </div>

      <div className="space-y-2.5">
        {findings.map((finding, idx) => {
          const s = STYLES[finding.severity] || STYLES.info;
          return (
            <div
              key={finding.id}
              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all duration-300 hover:translate-x-0.5 animate-fade ${s.wrap}`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {s.icon}
              <div className="text-xs flex-1">
                <p className="font-semibold text-espresso leading-relaxed">{finding.message}</p>
                {finding.source_reference && (
                  <p className="text-[11px] text-stonewarm mt-1 font-mono">
                    Source: {finding.source_reference}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
