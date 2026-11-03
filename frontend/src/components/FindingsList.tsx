import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { KeyFinding } from '../types';

interface FindingsListProps {
  findings: KeyFinding[];
}

export const FindingsList: React.FC<FindingsListProps> = ({ findings }) => {
  const getIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case 'danger':
        return <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />;
    }
  };

  const getBorderColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'border-emerald-500/20 bg-emerald-500/5';
      case 'warning':
        return 'border-amber-500/20 bg-amber-500/5';
      case 'danger':
        return 'border-rose-500/20 bg-rose-500/5';
      default:
        return 'border-cyan-500/20 bg-cyan-500/5';
    }
  };

  return (
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Key Findings</h3>
        <span className="text-xs text-slate-400 font-medium">Cross-Doc & Registry Evidence</span>
      </div>

      <div className="space-y-2.5">
        {findings.map((finding) => (
          <div
            key={finding.id}
            className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${getBorderColor(finding.severity)}`}
          >
            {getIcon(finding.severity)}
            <div className="text-xs flex-1">
              <p className="font-semibold text-slate-100">{finding.message}</p>
              {finding.source_reference && (
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Source: {finding.source_reference}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Key findings
