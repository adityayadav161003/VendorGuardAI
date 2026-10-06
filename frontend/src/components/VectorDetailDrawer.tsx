import React from 'react';
import { X, Shield, FileCheck, AlertTriangle, Layers, Info } from 'lucide-react';
import { RiskVectorDetail } from '../types';

interface VectorDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vectorName: string;
  detail: RiskVectorDetail | null;
  score: number | null;
}

const REASON_EXPLANATIONS: Record<string, { label: string; desc: string; penalty?: string }> = {
  ID_GSTIN_PAN_MISMATCH: {
    label: 'GSTIN–PAN Inconsistency',
    desc: 'The PAN embedded inside the GSTIN does not match the standalone PAN on record.',
    penalty: '-45 pts',
  },
  ID_INVALID_GSTIN_CHECKSUM: {
    label: 'Invalid GSTIN Checksum',
    desc: 'The 15th character modulo-36 weighted checksum verification failed.',
    penalty: '-30 pts',
  },
  ID_PAN_INVALID_STRUCTURE: {
    label: 'Invalid PAN Structure',
    desc: 'The 4th entity-type character or checksum sequence does not follow Income Tax Dept rules.',
    penalty: '-25 pts',
  },
  DOCS_EXPIRED_CERTIFICATE: {
    label: 'Expired Statutory Certificate',
    desc: 'One or more required compliance or ISO certificates have passed their validity date.',
    penalty: '-40 pts',
  },
  DOCS_EXPIRING_SOON: {
    label: 'Certificate Expiring Soon',
    desc: 'A statutory certificate expires within the next 30 days and requires renewal.',
    penalty: '-15 pts',
  },
  DOCS_CONFLICTING_IDENTIFIERS: {
    label: 'Cross-Document Identifier Mismatch',
    desc: 'Inconsistent registration numbers, CIN or bank account numbers found across documents.',
    penalty: '-30 pts',
  },
  DOCS_UNREADABLE_FILES_EXCLUDED: {
    label: 'Unreadable Documents Excluded',
    desc: 'Uploaded scans without readable text were quarantined for manual verification.',
    penalty: '-25 pts',
  },
  FIN_BANK_NAME_MISMATCH: {
    label: 'Bank Account Holder Mismatch',
    desc: 'The verified bank account beneficiary name differs from the registered company name.',
    penalty: '-35 pts',
  },
  FIN_PRICE_ANOMALY_DETECTED: {
    label: 'Statistical Price Outlier',
    desc: 'Interquartile range (IQR) analysis detected unusual pricing deviations across submissions.',
    penalty: '-20 pts',
  },
  NET_SHARED_DIRECTOR: {
    label: 'Shared Director Network',
    desc: 'Director is associated with multiple related entities across the supplier graph.',
    penalty: '-20 pts',
  },
  NET_SHARED_ADDRESS: {
    label: 'Shared Physical Address',
    desc: 'Multiple registered entities share an identical registered office address.',
    penalty: '-20 pts',
  },
  NET_HIGH_CENTRALITY: {
    label: 'High Network Centrality',
    desc: 'Entity occupies a central hub position across multiple supplier clusters.',
    penalty: '-10 pts',
  },
  REP_NEGATIVE_EXTERNAL_REPORT: {
    label: 'Adverse External Signals',
    desc: 'Regulatory, sanctions, or verified negative review notices detected in external records.',
    penalty: '-15 pts',
  },
  REP_SANCTION_OR_DEBARMENT_ALERT: {
    label: 'Debarment / Sanctions Flag',
    desc: 'Entity match detected in statutory debarment or shell company watchlists.',
    penalty: '-30 pts',
  },
};

export const VectorDetailDrawer: React.FC<VectorDetailDrawerProps> = ({
  isOpen,
  onClose,
  vectorName,
  detail,
  score,
}) => {
  if (!isOpen) return null;

  const statusLabel =
    detail?.status === 'computed'
      ? 'Computed from Stored Evidence'
      : detail?.status === 'insufficient'
      ? 'Insufficient Evidence (Excluded from Score)'
      : 'Not Applicable';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-espresso/60 backdrop-blur-xs transition-opacity animate-fade"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-cream-50 h-full shadow-2xl border-l border-cream-300 flex flex-col z-10 animate-slide-left overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-cream-300 bg-cream-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-olive-700 flex items-center justify-center text-cream-50 shadow-panel">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <span className="section-label">Trust Vector Audit</span>
              <h2 className="font-display text-xl font-bold text-espresso capitalize">
                {vectorName} Vector
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stonewarm hover:text-espresso hover:bg-cream-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Score & Status Card */}
          <div className="card-premium p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-brown-600 block">Vector Score</span>
              <span className="font-display text-3xl font-bold text-espresso">
                {score !== null ? `${score}/100` : 'N/A'}
              </span>
              <span className="text-[11px] text-stonewarm block mt-0.5">{statusLabel}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-brown-600 block">Rule Version</span>
              <span className="font-mono text-xs font-semibold text-olive-800 bg-olive-100 px-2.5 py-1 rounded-md border border-olive-300 inline-block mt-1">
                {detail?.rule_version || 'v2.0.0-trust-core'}
              </span>
            </div>
          </div>

          {/* Triggered Reason Codes & Penalties */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">Triggered Rules & Reason Codes</span>
              <span className="text-xs text-stonewarm font-mono">
                {detail?.reason_codes.length || 0} rule(s)
              </span>
            </div>

            {(!detail?.reason_codes || detail.reason_codes.length === 0) ? (
              <div className="p-4 rounded-xl bg-cream-100 border border-cream-300 text-xs text-brown-600 flex items-center gap-2">
                <Info className="w-4 h-4 text-olive-600 shrink-0" />
                <span>No negative penalty rules triggered for this vector.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {detail.reason_codes.map((code, idx) => {
                  const info = REASON_EXPLANATIONS[code] || {
                    label: code,
                    desc: 'Triggered deterministic statutory rule or cross-check heuristic.',
                  };
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-brass/40 bg-[#F5ECD6] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-espresso">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-gold-deep shrink-0" />
                          {info.label}
                        </span>
                        {info.penalty && (
                          <span className="font-mono text-terracotta-deep font-bold text-[11px]">
                            {info.penalty}
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-brown-700 leading-relaxed pl-5.5">
                        {info.desc}
                      </p>
                      <div className="pl-5.5 pt-0.5">
                        <code className="text-[10px] text-stonewarm bg-cream-100 px-1.5 py-0.5 rounded border border-cream-300">
                          code: {code}
                        </code>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Evidence Citations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="section-label">Backing Evidence Records</span>
              <span className="text-xs text-stonewarm font-mono">
                {detail?.evidence_ids.length || 0} cited
              </span>
            </div>

            {(!detail?.evidence_ids || detail.evidence_ids.length === 0) ? (
              <div className="p-4 rounded-xl bg-cream-100 border border-cream-300 text-xs text-brown-600 flex items-center gap-2">
                <Layers className="w-4 h-4 text-stonewarm shrink-0" />
                <span>
                  No direct evidence documents found on file. In accordance with the Product Thesis,
                  unverified vectors are flagged as insufficient rather than defaulted to a clean score.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.evidence_ids.map((eid, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-cream-300 bg-linen flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 text-espresso">
                      <FileCheck className="w-3.5 h-3.5 text-olive-700 shrink-0" />
                      <span className="font-mono text-[11px] truncate max-w-[280px]">
                        evidence_id: {eid}
                      </span>
                    </div>
                    <span className="badge-success !text-[10px]">Verified Record</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Explanatory thesis notice */}
          <div className="p-3.5 rounded-xl bg-cream-150 border border-cream-300 text-[11px] text-brown-600 leading-relaxed">
            <strong className="text-espresso font-semibold">VendorGuard Trust Guarantee:</strong>
            <p className="mt-0.5">
              Vector scores begin at 100 and only evaluate rules when supporting evidence exists.
              If evidence is missing, the score is marked insufficient and excluded from the overall
              weighted average.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cream-300 bg-cream-100 flex justify-end">
          <button onClick={onClose} className="btn-ghost !text-xs">
            Close Audit Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
