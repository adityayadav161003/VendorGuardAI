import React, { useState } from 'react';
import { BellRing, ChevronDown, ChevronUp, AlertTriangle, AlertOctagon, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { SupplierAlert } from '../types';

interface GlobalStatusBarProps {
  alerts: SupplierAlert[];
  dataSource?: string;
  isEvidenceGrounded?: boolean;
}

export const GlobalStatusBar: React.FC<GlobalStatusBarProps> = ({
  alerts,
  dataSource,
  isEvidenceGrounded,
}) => {
  const [expanded, setExpanded] = useState(false);

  const dangerCount = alerts.filter(a => a.severity === 'danger').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const isDemo = dataSource === 'DEMO_FIXTURES';

  if (alerts.length === 0 && !isDemo) {
    return null;
  }

  return (
    <div className="sticky top-[61px] z-40 bg-linen/95 backdrop-blur-md border-b border-cream-300 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs gap-3">
        {/* Left: Alerts pill or Demo pill */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDemo && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brass/20 text-gold-deep border border-brass/50 animate-pulse">
              <Sparkles className="w-3 h-3 text-gold-deep" />
              Demo Data Mode · Synthetic Supplier Records
            </span>
          )}

          {alerts.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 text-espresso border border-cream-300 transition-colors font-medium cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5 text-gold-deep" />
              <span>
                <strong>{alerts.length}</strong> active alert{alerts.length > 1 ? 's' : ''}
              </span>
              {dangerCount > 0 && (
                <span className="badge-danger !py-0 !px-1.5 !text-[10px]">
                  {dangerCount} critical
                </span>
              )}
              {warningCount > 0 && (
                <span className="badge-warning !py-0 !px-1.5 !text-[10px]">
                  {warningCount} warning
                </span>
              )}
              {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-stonewarm" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 text-stonewarm" />}
            </button>
          )}

          {isEvidenceGrounded && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-olive-800">
              <CheckCircle2 className="w-3 h-3 text-olive-600" />
              All presented claims verified against stored records
            </span>
          )}
        </div>

        {/* Right: Quick action */}
        {alerts.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-brown-600 hover:text-espresso font-semibold underline underline-offset-2 cursor-pointer"
          >
            {expanded ? 'Hide details' : 'Review alerts'}
          </button>
        )}
      </div>

      {/* Expanded Alert Drawer */}
      {expanded && alerts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 border-t border-cream-300 bg-cream-50 animate-slide-down space-y-2">
          <div className="flex items-center justify-between pb-1">
            <span className="section-label">Active Monitoring Alerts</span>
            <span className="text-[11px] text-stonewarm font-mono">Real-time statutory triggers</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map((a, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                  a.severity === 'danger'
                    ? 'border-terracotta/40 bg-terracotta/10 text-terracotta-deep'
                    : 'border-brass/40 bg-brass/10 text-gold-deep'
                }`}
              >
                {a.severity === 'danger' ? (
                  <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5 text-terracotta" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-gold" />
                )}
                <div className="flex-1">
                  <span className="font-bold">{a.category}: </span>
                  <span>{a.message}</span>
                  {a.source_reference && (
                    <span className="block text-[10px] text-stonewarm mt-0.5 font-mono">
                      Ref: {a.source_reference}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
