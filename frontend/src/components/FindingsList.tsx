import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  GitCompare,
  FileText,
  Check,
  Eye,
  Slash,
} from 'lucide-react';
import { KeyFinding } from '../types';

interface FindingsListProps {
  findings: KeyFinding[];
  onStatusChange?: (findingId: string, status: 'OPEN' | 'REVIEWED' | 'WAIVED') => void;
}

export const FindingsList: React.FC<FindingsListProps> = ({ findings, onStatusChange }) => {
  // Local state for interactive status overrides
  const [findingStatuses, setFindingStatuses] = useState<Record<string, 'OPEN' | 'REVIEWED' | 'WAIVED'>>({});

  const getStatus = (finding: KeyFinding): 'OPEN' | 'REVIEWED' | 'WAIVED' => {
    return findingStatuses[finding.id] || finding.status || 'OPEN';
  };

  const handleStatusUpdate = (id: string, status: 'OPEN' | 'REVIEWED' | 'WAIVED') => {
    setFindingStatuses(prev => ({ ...prev, [id]: status }));
    onStatusChange?.(id, status);
  };

  // Partition findings into Cross-Document Conflicts vs General Findings
  const conflicts = findings.filter(f => f.conflict_type || f.source_b || f.source_a_details);
  const generalFindings = findings.filter(f => !f.conflict_type && !f.source_b && !f.source_a_details);

  return (
    <div className="card-premium card-hover p-6 h-full space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-espresso">
            Cross-Document Consistency & Conflicts
          </h3>
          <p className="text-[11px] text-stonewarm">
            Deterministic cross-referencing with dual-source citations and reviewer actions
          </p>
        </div>
        <span className="badge-info">
          {conflicts.length} Mismatch Card{conflicts.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ── Section 1: Side-by-Side Conflict Cards ──────── */}
      {conflicts.length === 0 ? (
        <div className="p-4 rounded-xl bg-olive-50 border border-olive-200 text-xs text-olive-900 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-sage-deep shrink-0" />
          <span>No statutory identifier or bank account discrepancies found across submitted documents.</span>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((item, idx) => {
            const currentStatus = getStatus(item);
            const isDanger = item.severity === 'danger';
            const a = item.source_a_details || {
              document_name: 'Source Document A',
              page: 1,
              snippet: item.source_a || 'Value on file',
              value: item.source_a || '',
            };
            const b = item.source_b_details || {
              document_name: 'Source Document B',
              page: 1,
              snippet: item.source_b || 'Value on file',
              value: item.source_b || '',
            };

            return (
              <div
                key={item.id || idx}
                className={`p-4 rounded-xl border transition-all duration-200 animate-rise ${
                  currentStatus === 'WAIVED'
                    ? 'border-cream-300 bg-cream-100/50 opacity-60'
                    : isDanger
                    ? 'border-terracotta/40 bg-[#FDF2EE]'
                    : 'border-brass/40 bg-[#FDF9ED]'
                }`}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                {/* Header: Title & Status Actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-2.5">
                    {isDanger ? (
                      <AlertOctagon className="w-4 h-4 text-terracotta-deep shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-gold-deep shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-semibold text-xs text-espresso leading-snug">
                        {item.message}
                      </h4>
                      <span className="text-[10px] font-mono text-stonewarm block mt-0.5">
                        Conflict Type: {item.conflict_type || 'CROSS_DOC_DISCREPANCY'}
                        {item.similarity_score !== undefined && ` · Similarity: ${(item.similarity_score * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges & Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`badge !text-[9px] ${
                      currentStatus === 'OPEN' ? (isDanger ? 'badge-danger' : 'badge-warning')
                      : currentStatus === 'REVIEWED' ? 'badge-success'
                      : 'badge-info'
                    }`}>
                      {currentStatus}
                    </span>

                    <button
                      onClick={() => handleStatusUpdate(item.id, 'REVIEWED')}
                      title="Mark as Reviewed"
                      className={`p-1 rounded text-xs transition-colors ${
                        currentStatus === 'REVIEWED' ? 'bg-olive-700 text-cream-50' : 'bg-cream-200 hover:bg-cream-300 text-brown-700'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(item.id, 'WAIVED')}
                      title="Waive Discrepancy"
                      className={`p-1 rounded text-xs transition-colors ${
                        currentStatus === 'WAIVED' ? 'bg-brown-700 text-cream-50' : 'bg-cream-200 hover:bg-cream-300 text-brown-700'
                      }`}
                    >
                      <Slash className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Side-by-Side Dual Source Citation Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  {/* Source A */}
                  <div className="p-3 rounded-lg bg-linen border border-cream-300 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-brown-700 border-b border-cream-200 pb-1">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-olive-700" />
                        {a.document_name || 'Document A'}
                      </span>
                      <span className="text-[10px] text-stonewarm font-mono">
                        Page {a.page || 1}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] text-stonewarm uppercase tracking-wide block">Extracted Value</span>
                      <span className="font-mono font-bold text-espresso text-[11.5px] break-all">
                        {a.value || a.snippet || '—'}
                      </span>
                    </div>
                    {a.snippet && a.snippet !== a.value && (
                      <p className="text-[10.5px] text-brown-600 bg-cream-100 p-1.5 rounded border border-cream-250 italic">
                        "{a.snippet}"
                      </p>
                    )}
                  </div>

                  {/* Source B */}
                  <div className="p-3 rounded-lg bg-linen border border-cream-300 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-brown-700 border-b border-cream-200 pb-1">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-terracotta-deep" />
                        {b.document_name || 'Document B'}
                      </span>
                      <span className="text-[10px] text-stonewarm font-mono">
                        Page {b.page || 1}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[10px] text-stonewarm uppercase tracking-wide block">Conflicting Value</span>
                      <span className="font-mono font-bold text-espresso text-[11.5px] break-all">
                        {b.value || b.snippet || '—'}
                      </span>
                    </div>
                    {b.snippet && b.snippet !== b.value && (
                      <p className="text-[10.5px] text-brown-600 bg-cream-100 p-1.5 rounded border border-cream-250 italic">
                        "{b.snippet}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Section 2: General Statutory & Expiry Findings ── */}
      {generalFindings.length > 0 && (
        <div className="pt-4 border-t border-cream-300 space-y-2.5">
          <span className="section-label block">Additional Risk & Regulatory Signals</span>
          <div className="space-y-2">
            {generalFindings.map((finding, idx) => (
              <div
                key={finding.id || idx}
                className="p-3 rounded-xl border border-cream-300 bg-cream-100/60 text-xs flex items-start gap-2.5"
              >
                {finding.severity === 'danger' ? (
                  <AlertOctagon className="w-4 h-4 text-terracotta shrink-0 mt-0.5" />
                ) : finding.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-sage-deep shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-espresso">{finding.message}</p>
                  {finding.source_reference && (
                    <span className="text-[10px] text-stonewarm font-mono mt-0.5 block">
                      Source: {finding.source_reference}
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
