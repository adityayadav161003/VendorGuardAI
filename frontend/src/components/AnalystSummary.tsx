import React, { useState } from 'react';
import { Bot, CheckCircle, AlertCircle, ArrowRight, ShieldCheck, FileText } from 'lucide-react';
import { AnalysisReport } from '../types';

interface AnalystSummaryProps {
  report: AnalysisReport;
}

export const AnalystSummary: React.FC<AnalystSummaryProps> = ({ report }) => {
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

  const verifiedCount = report.claims.filter(c => c.status === 'SUPPORTED').length;
  const reviewCount = report.claims.filter(c => c.status !== 'SUPPORTED').length;

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
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                claim.status === 'SUPPORTED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {claim.status}
              </span>
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
          </div>
        )}
      </div>
    </div>
  );
};

// Grounded summary
