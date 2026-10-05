import React, { useState } from 'react';
import { Bot, CheckCircle, AlertCircle, ArrowRight, ShieldCheck, FileText, ThumbsUp, ThumbsDown, XCircle } from 'lucide-react';
import { AnalysisReport, ClaimVerification } from '../types';
import { api } from '../services/api';
import { useAuth } from '../auth/AuthContext';

interface AnalystSummaryProps {
  report: AnalysisReport;
  onReviewRecorded?: () => void;
}

const REVIEWER_BADGES: Record<string, string> = {
  PENDING: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  OVERRIDDEN: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  REJECTED: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
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
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            AI Analyst Summary
          </h3>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Evidence Grounded
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> {verifiedCount} claims verified
          </span>
          {reviewCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertCircle className="w-3 h-3" /> {reviewCount} claim needs review
            </span>
          )}
        </div>
      </div>

      {/* Grounded Summary Text */}
      <div className="p-4 rounded-xl bg-[#0d1424] border border-[#1e293b] text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
        <p>"{report.summary}"</p>
      </div>

      {/* Claim-by-Claim Interactive Inspector */}
      <div className="mt-4">
        <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
          Verifiable Claim Deconstruction (FEVER NLI Model)
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {report.claims.map((claim) => (
            <button
              key={claim.claim_id}
              onClick={() => setSelectedClaim(claim)}
              className={`p-2.5 rounded-lg border text-left transition-all text-xs flex items-start justify-between gap-2 ${
                selectedClaim?.claim_id === claim.claim_id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-[#1e293b] bg-[#0d1424]/50 hover:bg-[#1a243d]'
              }`}
            >
              <div className="flex items-start gap-2">
                {claim.status === 'SUPPORTED' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="text-slate-200 line-clamp-2">{claim.claim_text}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                    Doc: {claim.source_doc_name || 'System Registry'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  claim.status === 'SUPPORTED' ? 'bg-emerald-500/20 text-emerald-400'
                    : claim.status === 'CONTRADICTED' ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {claim.status}
                </span>
                {claim.reviewer_state !== 'PENDING' && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${REVIEWER_BADGES[claim.reviewer_state]}`}>
                    {claim.reviewer_state}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Claim Evidence Modal / Drawer */}
        {selectedClaim && (
          <div className="mt-3 p-3.5 rounded-lg bg-blue-950/30 border border-blue-500/30 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-blue-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Grounded Evidence Snippet
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                Confidence: {(selectedClaim.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-slate-300 bg-[#0d1424] p-2.5 rounded border border-[#1e293b] font-mono text-[11px]">
              "{selectedClaim.evidence_snippet}"
            </p>

            {/* Human review actions (reviewer/admin only; decisions stored separately from model output) */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              {!canReview && (
                <span className="text-[10px] text-slate-500">
                  Reviewer or admin role required to record claim decisions.
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${REVIEWER_BADGES[selectedClaim.reviewer_state]}`}>
                Reviewer: {selectedClaim.reviewer_state}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => recordReview('APPROVED')}
                  hidden={!canReview}
                  disabled={reviewBusy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 font-semibold disabled:opacity-50 transition-colors"
                >
                  <ThumbsUp className="w-3 h-3" /> Confirm
                </button>
                <button
                  onClick={() => recordReview('OVERRIDDEN')}
                  disabled={reviewBusy}
                  hidden={!canReview}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 font-semibold disabled:opacity-50 transition-colors"
                >
                  <AlertCircle className="w-3 h-3" /> Override
                </button>
                <button
                  onClick={() => recordReview('REJECTED')}
                  disabled={reviewBusy}
                  hidden={!canReview}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-semibold disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-3 h-3" /> Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Grounded summary
