import React from 'react';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Layers,
  Calendar,
  MapPin,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AnalysisReport } from '../types';

interface ScoreCardProps {
  report: AnalysisReport;
  onOpenVectorAudit?: (vectorKey: string) => void;
}

const LEVEL_COLORS = {
  LOW: '#77854A',
  MEDIUM: '#C29B4A',
  HIGH: '#B0563A',
} as const;

export const ScoreCard: React.FC<ScoreCardProps> = ({ report, onOpenVectorAudit }) => {
  const score = report.risk_score;
  const isAssessable = report.assessment_state !== 'NOT_ASSESSABLE' && score !== null;
  const level = (report.risk_level in LEVEL_COLORS ? report.risk_level : 'MEDIUM') as keyof typeof LEVEL_COLORS;
  const stroke = isAssessable ? LEVEL_COLORS[level] : '#C8BFAC';

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = isAssessable && score !== null
    ? circumference - (score / 100) * circumference
    : circumference;

  // Extract top 3 issues
  const topIssues = report.key_findings
    .filter(f => f.severity === 'danger' || f.severity === 'warning')
    .slice(0, 3);

  // Derive honest recommended next action
  let recommendedAction = 'Review findings and approve or request revisions.';
  if (report.assessment_state === 'NOT_ASSESSABLE') {
    recommendedAction = 'Action Required: Send self-service upload invite to supplier for statutory filings (GST, PAN, Incorporation).';
  } else if (report.assessment_state === 'PROVISIONAL') {
    recommendedAction = report.provisional_reason || 'Action Required: Submit additional proof (audited bank statement or ISO) to remove provisional status.';
  } else if (report.risk_level === 'HIGH') {
    recommendedAction = 'Caution: Dual reviewer sign-off required due to high risk or critical document discrepancies.';
  } else if (topIssues.length > 0) {
    recommendedAction = `Action Required: Reconcile ${topIssues[0].category.toLowerCase()} discrepancy before issuing purchase order.`;
  } else {
    recommendedAction = 'All submitted evidence verified. Suitable for standard procurement onboarding.';
  }

  // Count verified sources
  const sourcesChecked = [
    report.document_count > 0 ? 'Document Repository' : null,
    report.data_source === 'DEMO_FIXTURES' ? 'Synthetic Registries' : 'Statutory Checksums',
    report.claims.length > 0 ? 'Cross-Doc Consistency' : null,
  ].filter(Boolean);

  return (
    <div className="card-premium p-6 space-y-6 animate-rise shadow-panel">
      {/* ── Top Row: Identity & Score Ring ───────────────── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Supplier Profile Info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-olive-600 to-olive-800 border border-olive-900/40 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-8px_rgba(60,69,37,0.65)] shrink-0">
            <Building2 className="w-7 h-7 text-cream-50" />
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-2xl font-bold text-espresso tracking-tight">
                {report.supplier_name}
              </h2>

              {/* State Badge */}
              {report.assessment_state === 'ASSESSED' && (
                <span className="badge-success flex items-center gap-1.5 py-1 px-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sage-deep" />
                  Assessed
                </span>
              )}
              {report.assessment_state === 'PROVISIONAL' && (
                <span className="badge-warning flex items-center gap-1.5 py-1 px-2.5">
                  <AlertCircle className="w-3.5 h-3.5 text-gold-deep" />
                  Provisional Assessment
                </span>
              )}
              {report.assessment_state === 'NOT_ASSESSABLE' && (
                <span className="badge-danger flex items-center gap-1.5 py-1 px-2.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-terracotta-deep" />
                  Not Assessable
                </span>
              )}

              {report.is_evidence_grounded && (
                <span className="badge-info flex items-center gap-1 py-1 px-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-olive-700" />
                  Evidence Grounded
                </span>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 mt-3 text-xs text-brown-600">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brass" />
                <span>Coverage: <strong className="text-espresso font-mono font-bold">{report.evidence_coverage}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brass" />
                <span>Confidence: <strong className="text-espresso font-mono font-bold">{report.assessment_confidence}%</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brass" />
                <span>Documents: <strong className="text-espresso">{report.document_count}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-stonewarm">Rules:</span>
                <span className="font-mono text-espresso text-[11px] bg-cream-150 px-1.5 py-0.5 rounded border border-cream-300">
                  {report.rule_version || 'v2.0.0'}
                </span>
              </div>
            </div>

            {report.provisional_reason && (
              <p className="mt-2 text-xs text-terracotta-deep bg-[#FDF0ED] border border-terracotta/30 rounded-lg px-2.5 py-1.5 max-w-xl">
                <strong>Provisional Notice:</strong> {report.provisional_reason}
              </p>
            )}
          </div>
        </div>

        {/* Interactive Score Ring */}
        <div
          onClick={() => onOpenVectorAudit?.('composite')}
          title="Click to audit composite trust score & rule weights"
          className="flex items-center gap-5 bg-cream-100/90 border border-cream-300 px-6 py-4 rounded-2xl shrink-0 shadow-panel cursor-pointer hover:border-olive-400 hover:shadow-card transition-all"
        >
          <div className="relative w-[110px] h-[110px] flex items-center justify-center">
            <svg className="w-[110px] h-[110px] -rotate-90">
              <defs>
                <linearGradient id="scoreRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={stroke} />
                  <stop offset="100%" stopColor={isAssessable ? '#B9975B' : '#C8BFAC'} />
                </linearGradient>
              </defs>
              <circle cx="55" cy="55" r={radius} stroke="#E7DCC3" strokeWidth="9" fill="transparent" />
              <circle
                cx="55"
                cy="55"
                r={radius}
                stroke="url(#scoreRingGrad)"
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[1.85rem] leading-none font-bold text-espresso">
                {score !== null ? score : 'N/A'}
              </span>
              <span className="text-[9.5px] text-stonewarm uppercase tracking-[0.16em] font-bold mt-1">
                {score !== null ? '/ 100' : 'NO SCORE'}
              </span>
            </div>
          </div>

          <div>
            <span className="section-label block">Composite Trust Score</span>
            <div className={`mt-1.5 badge px-3 py-1 text-xs font-bold inline-block ${
              !isAssessable ? 'bg-cream-300 text-brown-600 border border-sand-400'
              : level === 'LOW' ? 'badge-success' : level === 'MEDIUM' ? 'badge-warning' : 'badge-danger'
            }`}>
              {report.risk_level} RISK
            </div>
            <p className="text-[11px] text-brown-600 mt-1.5 max-w-[140px] leading-snug">
              {report.assessment_state === 'NOT_ASSESSABLE'
                ? 'Score withheld: insufficient evidence.'
                : report.assessment_state === 'PROVISIONAL'
                ? 'Provisional score: review recommended.'
                : 'Click ring to inspect vector breakdown.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Middle: Top 3 Issues & Next Action ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-cream-300">
        {/* Top 3 Issues */}
        <div className="p-4 rounded-xl bg-cream-100/70 border border-cream-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="section-label">Top Identified Discrepancies</span>
            <span className="text-[11px] font-mono text-stonewarm">
              {topIssues.length > 0 ? `${topIssues.length} priority item(s)` : 'None detected'}
            </span>
          </div>

          {topIssues.length === 0 ? (
            <p className="text-xs text-olive-800 flex items-center gap-1.5 py-1">
              <CheckCircle2 className="w-4 h-4 text-olive-600 shrink-0" />
              No critical or warning discrepancies detected in submitted evidence.
            </p>
          ) : (
            <div className="space-y-1.5">
              {topIssues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                    issue.severity === 'danger' ? 'bg-terracotta' : 'bg-gold'
                  }`} />
                  <span className="text-espresso leading-snug line-clamp-1">
                    <strong className="font-semibold text-brown-800">{issue.category}: </strong>
                    {issue.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Next Action */}
        <div className="p-4 rounded-xl bg-linen border border-brass/40 space-y-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-olive-700 animate-ping" />
              <span className="section-label !text-olive-900">Recommended Next Action</span>
            </div>
            <p className="text-xs text-espresso font-medium leading-relaxed">
              {recommendedAction}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-brown-600 border-t border-cream-300">
            <span>Confidence Cap: {report.evidence_coverage}%</span>
            <span className="font-semibold text-olive-800 flex items-center gap-1">
              Decision Support Only <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom: Evidence Basis Strip ─────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-cream-50 p-3 rounded-xl border border-cream-300">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-espresso">Evidence Basis:</span>
          <span className={`badge ${
            report.data_source === 'UPLOADED_DOCUMENTS' ? 'badge-success'
            : report.data_source === 'DEMO_FIXTURES' ? 'badge-info'
            : 'badge-danger'
          } !text-[10px]`}>
            {report.data_source.replace('_', ' ')}
          </span>
          <span className="text-stonewarm">· {report.document_count} file(s) evaluated</span>
          <span className="text-stonewarm">· Coverage: {report.evidence_coverage}%</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-stonewarm">
          <span>Sources checked:</span>
          {sourcesChecked.map((src, i) => (
            <span key={i} className="bg-cream-150 px-2 py-0.5 rounded text-brown-700 font-mono text-[10px] border border-cream-300">
              {src}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
