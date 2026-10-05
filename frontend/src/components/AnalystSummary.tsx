import React, { useState } from 'react';
import { Bot, CheckCircle, AlertCircle, ShieldCheck, FileText, ThumbsUp, ThumbsDown, XCircle } from 'lucide-react';
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
};

export const AnalystSummary: React.FC<AnalystSummaryProps> = ({ report, onReviewRecorded }) => {
  const { canReview } = useAuth();
  const [selectedClaim, setSelectedClaim] = useState<ClaimVerification | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  const verifiedCount = report.claims.filter(c => c.status === 'SUPPORTED').length;
  const reviewCount = report.claims.filter(c => c.status !== 'SUPPORTED').length;

  const recordReview = async (action: 'APPROVED' | 'OVERRIDDEN' | 'REJECTED') => {
    if (!selectedClaim) return;
    setReviewBusy(true);
    try {
      const result = await api.reviewClaim(selectedClaim.claim_id, action);
      setSelectedClaim({ ...selectedClaim, reviewer_state: result.reviewer_state as ClaimVerification['reviewer_state'] });
      onReviewRecorded?.();
    } catch (err) {
      console.error('Failed to record review:', err);
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <div className="card-premium card-hover p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Bot className="w-4 h-4 text-brass-light" />
          </span>
          <h3 className="font-display text-lg font-semibold text-espresso">AI Analyst Summary</h3>
          <span className="badge-success">
            <ShieldCheck className="w-3 h-3" /> Evidence Grounded
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge-success">
            <CheckCircle className="w-3 h-3" /> {verifiedCount} claims verified
          </span>
          {reviewCount > 0 && (
            <span className="badge-warning">
              <AlertCircle className="w-3 h-3" /> {reviewCount} need review
            </span>
          )}
        </div>
      </div>

      {/* Grounded summary */}
      <div className="p-4.5 p-4 rounded-xl bg-cream-100 border border-cream-300 shadow-panel text-sm text-espresso leading-relaxed">
        <p className="font-display italic">“{report.summary}”</p>
      </div>

      {/* Claim deconstruction */}
      <div className="mt-5">
        <span className="section-label block mb-3">Verifiable Claim Deconstruction · FEVER-style NLI</span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {report.claims.map((claim, idx) => (
            <button
              key={claim.claim_id}
              onClick={() => setSelectedClaim(claim)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 text-xs flex items-start justify-between gap-2 cursor-pointer animate-fade hover:-translate-y-0.5 hover:shadow-card ${
                selectedClaim?.claim_id === claim.claim_id
                  ? 'border-brass bg-[#F5ECD6] shadow-brass'
                  : 'border-cream-300 bg-cream-50 hover:border-olive-400/60'
              }`}
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className="flex items-start gap-2.5">
                {claim.status === 'SUPPORTED'
                  ? <CheckCircle className="w-4 h-4 text-sage-deep shrink-0 mt-0.5" />
                  : claim.status === 'CONTRADICTED'
                    ? <XCircle className="w-4 h-4 text-terracotta-deep shrink-0 mt-0.5" />
                    : <AlertCircle className="w-4 h-4 text-gold-deep shrink-0 mt-0.5" />}
                <div>
                  <span className="text-espresso leading-relaxed line-clamp-2">{claim.claim_text}</span>
                  <span className="text-[10px] text-stonewarm block mt-1 font-mono">
                    Doc: {claim.source_doc_name || 'System Registry'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`badge ${
                  claim.status === 'SUPPORTED' ? 'badge-success'
                    : claim.status === 'CONTRADICTED' ? 'badge-danger'
                    : 'badge-warning'
                } !text-[10px]`}>
                  {claim.status}
                </span>
                {claim.reviewer_state !== 'PENDING' && (
                  <span className={`badge !text-[9px] ${REVIEWER_BADGES[claim.reviewer_state]}`}>
                    {claim.reviewer_state}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Evidence drawer */}
        {selectedClaim && (
          <div className="mt-4 p-4 rounded-xl bg-cream-100 border border-brass/50 shadow-panel text-xs animate-scale-in">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-brown-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brass-deep" /> Grounded Evidence Snippet
              </span>
              <span className="font-mono text-[10px] text-stonewarm">
                Confidence: {(selectedClaim.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-espresso bg-linen p-3 rounded-lg border border-cream-300 font-mono text-[11px] leading-relaxed">
              "{selectedClaim.evidence_snippet}"
            </p>

            {/* Human review actions (reviewer/admin only) */}
            <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
              <span className={`badge ${REVIEWER_BADGES[selectedClaim.reviewer_state]}`}>
                Reviewer: {selectedClaim.reviewer_state}
              </span>
              {!canReview ? (
                <span className="text-[10px] text-stonewarm">
                  Reviewer or admin role required to record claim decisions.
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => recordReview('APPROVED')} disabled={reviewBusy} className="btn-primary !py-1.5 !px-3 !text-xs">
                    <ThumbsUp className="w-3 h-3" /> Confirm
                  </button>
                  <button onClick={() => recordReview('OVERRIDDEN')} disabled={reviewBusy} className="btn-brass !py-1.5 !px-3 !text-xs">
                    <AlertCircle className="w-3 h-3" /> Override
                  </button>
                  <button onClick={() => recordReview('REJECTED')} disabled={reviewBusy} className="btn-danger !py-1.5 !px-3 !text-xs">
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
