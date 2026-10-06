import React, { useState } from 'react';
import {
  Bot,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  FileText,
  ThumbsUp,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  Filter,
} from 'lucide-react';
import { AnalysisReport, ClaimVerification } from '../types';
import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';

interface AnalystSummaryProps {
  report: AnalysisReport;
  onReviewRecorded?: () => void;
}

const REVIEWER_BADGES: Record<string, string> = {
  PENDING: 'bg-cream-200 text-stonewarm-deep border-cream-400',
  APPROVED: 'bg-olive-100 text-olive-800 border-olive-300',
  OVERRIDDEN: 'bg-[#F3E7C9] text-gold-deep border-brass/50',
  REJECTED: 'bg-[#F4DED4] text-terracotta-deep border-terracotta/40',
  NEEDS_MORE_EVIDENCE: 'bg-[#EBF2F7] text-navy-800 border-navy-300',
};

export const AnalystSummary: React.FC<AnalystSummaryProps> = ({ report, onReviewRecorded }) => {
  const { canReview } = useAuth();
  const [selectedClaim, setSelectedClaim] = useState<ClaimVerification | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_EVIDENCE'>('ALL');
  const [reviewBusy, setReviewBusy] = useState(false);

  const verifiedCount = report.claims.filter(c => c.status === 'SUPPORTED').length;
  const contradictedCount = report.claims.filter(c => c.status === 'CONTRADICTED').length;
  const insufficientCount = report.claims.filter(c => c.status === 'INSUFFICIENT_EVIDENCE').length;

  const filteredClaims = report.claims.filter(c => {
    if (filter === 'ALL') return true;
    return c.status === filter;
  });

  const recordReview = async (action: 'APPROVED' | 'OVERRIDDEN' | 'REJECTED') => {
    if (!selectedClaim) return;
    setReviewBusy(true);
    try {
      const result = await api.reviewClaim(selectedClaim.claim_id, action);
      setSelectedClaim({
        ...selectedClaim,
        reviewer_state: result.reviewer_state as ClaimVerification['reviewer_state'],
      });
      onReviewRecorded?.();
    } catch (err) {
      console.error('Failed to record review:', err);
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="card-premium card-hover p-6 space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Bot className="w-4 h-4 text-brass-light" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              AI Analyst Summary & Claim Verification
            </h3>
            <p className="text-[11px] text-stonewarm">
              FEVER-style natural language inference against stored repository evidence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {report.is_evidence_grounded && (
            <span className="badge-success">
              <ShieldCheck className="w-3 h-3" /> Evidence Grounded
            </span>
          )}
          <span className="badge-info">
            {report.claims.length} Claims Extracted
          </span>
        </div>
      </div>

      {/* ── Grounded Summary Quote ────────────────────────── */}
      <div className="p-4.5 rounded-xl bg-cream-100 border border-cream-300 shadow-panel text-sm text-espresso leading-relaxed">
        <p className="font-display italic">“{report.summary}”</p>
      </div>

      {/* ── System Notices Box (Meta statements rendered distinctly) ── */}
      {report.system_notices && report.system_notices.length > 0 && (
        <div className="p-3.5 rounded-xl bg-cream-150 border border-cream-300 text-xs space-y-1.5 animate-fade">
          <div className="flex items-center gap-2 text-brown-800 font-semibold">
            <Info className="w-3.5 h-3.5 text-olive-700" />
            <span>Repository & Operational System Notices</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-brown-700 pl-1 text-[11.5px]">
            {report.system_notices.map((notice, idx) => (
              <li key={idx} className="leading-snug">{notice}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Claim Deconstruction ──────────────────────────── */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <span className="section-label">Verifiable Claim Deconstruction</span>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-espresso text-cream-50'
                  : 'bg-cream-150 hover:bg-cream-200 text-brown-700'
              }`}
            >
              All ({report.claims.length})
            </button>
            <button
              onClick={() => setFilter('SUPPORTED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'SUPPORTED'
                  ? 'bg-olive-700 text-cream-50'
                  : 'bg-olive-100/70 hover:bg-olive-100 text-olive-900'
              }`}
            >
              Supported ({verifiedCount})
            </button>
            <button
              onClick={() => setFilter('CONTRADICTED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'CONTRADICTED'
                  ? 'bg-terracotta text-cream-50'
                  : 'bg-terracotta/10 hover:bg-terracotta/20 text-terracotta-deep'
              }`}
            >
              Contradicted ({contradictedCount})
            </button>
            <button
              onClick={() => setFilter('INSUFFICIENT_EVIDENCE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filter === 'INSUFFICIENT_EVIDENCE'
                  ? 'bg-gold-deep text-cream-50'
                  : 'bg-brass/15 hover:bg-brass/25 text-gold-deep'
              }`}
            >
              Insufficient ({insufficientCount})
            </button>
          </div>
        </div>

        {/* Claims List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredClaims.map((claim, idx) => {
            const isSelected = selectedClaim?.claim_id === claim.claim_id;
            const confPercent = Math.round(claim.confidence_score * 100);

            return (
              <div
                key={claim.claim_id}
                onClick={() => setSelectedClaim(claim)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 text-xs flex flex-col justify-between gap-2.5 cursor-pointer animate-fade hover:-translate-y-0.5 hover:shadow-card ${
                  isSelected
                    ? 'border-brass bg-[#F5ECD6] shadow-brass'
                    : 'border-cream-300 bg-linen/90 hover:border-olive-400/60'
                }`}
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {claim.status === 'SUPPORTED' ? (
                      <CheckCircle className="w-4 h-4 text-sage-deep shrink-0 mt-0.5" />
                    ) : claim.status === 'CONTRADICTED' ? (
                      <XCircle className="w-4 h-4 text-terracotta-deep shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="w-4 h-4 text-gold-deep shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-espresso font-medium leading-relaxed">
                        {claim.claim_text}
                      </p>
                      <span className="text-[10px] text-stonewarm block mt-1 font-mono">
                        Source: {claim.source_doc_name || 'System Registry'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`badge !text-[9px] ${
                      claim.status === 'SUPPORTED' ? 'badge-success'
                      : claim.status === 'CONTRADICTED' ? 'badge-danger'
                      : 'badge-warning'
                    }`}>
                      {claim.status}
                    </span>
                    {claim.reviewer_state !== 'PENDING' && (
                      <span className={`badge !text-[8.5px] ${REVIEWER_BADGES[claim.reviewer_state]}`}>
                        {claim.reviewer_state}
                      </span>
                    )}
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="space-y-1 pt-1 border-t border-cream-250">
                  <div className="flex items-center justify-between text-[10px] text-brown-600">
                    <span>NLI Model Confidence</span>
                    <span className="font-mono font-bold text-espresso">{confPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-cream-250 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        claim.confidence_score >= 0.8 ? 'bg-olive-600' : 'bg-gold'
                      }`}
                      style={{ width: `${confPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Selected Claim Evidence Drawer ────────────────── */}
        {selectedClaim && (
          <div className="mt-4 p-4 rounded-xl bg-linen border border-brass/50 shadow-panel text-xs animate-scale-in space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-brown-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brass-deep" /> Stored Evidence Snippet
              </span>
              <span className="font-mono text-[10.5px] text-stonewarm">
                Document: {selectedClaim.source_doc_name || 'Unknown'} · Confidence: {(selectedClaim.confidence_score * 100).toFixed(0)}%
              </span>
            </div>

            <p className="text-espresso bg-cream-100 p-3 rounded-lg border border-cream-300 font-mono text-[11.5px] leading-relaxed">
              "{selectedClaim.evidence_snippet || 'No explicit textual snippet available in store.'}"
            </p>

            {/* Human Review Actions */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-cream-250">
              <span className={`badge ${REVIEWER_BADGES[selectedClaim.reviewer_state]}`}>
                Reviewer State: {selectedClaim.reviewer_state}
              </span>

              {!canReview ? (
                <span className="text-[11px] text-stonewarm">
                  Procurement Reviewer or Admin permissions required to log formal sign-offs.
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => recordReview('APPROVED')}
                    disabled={reviewBusy}
                    className="btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                  >
                    <ThumbsUp className="w-3 h-3" /> Approve Claim
                  </button>
                  <button
                    onClick={() => recordReview('OVERRIDDEN')}
                    disabled={reviewBusy}
                    className="btn-brass !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3 h-3" /> Override
                  </button>
                  <button
                    onClick={() => recordReview('REJECTED')}
                    disabled={reviewBusy}
                    className="btn-danger !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
