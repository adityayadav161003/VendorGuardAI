import React from 'react';
import { Building2, ShieldCheck, MapPin, Calendar, Layers } from 'lucide-react';
import { AnalysisReport } from '../types';

interface ScoreCardProps {
  report: AnalysisReport;
}

const LEVEL_COLORS = {
  LOW: '#77854A',
  MEDIUM: '#C29B4A',
  HIGH: '#B0563A',
} as const;

export const ScoreCard: React.FC<ScoreCardProps> = ({ report }) => {
  const score = report.risk_score;
  const isAssessable = report.assessment_state !== 'NOT_ASSESSABLE' && score !== null;
  const level = (report.risk_level in LEVEL_COLORS ? report.risk_level : 'MEDIUM') as keyof typeof LEVEL_COLORS;
  const stroke = isAssessable ? LEVEL_COLORS[level] : '#C8BFAC';

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = isAssessable && score !== null
    ? circumference - (score / 100) * circumference
    : circumference;

  return (
    <div className="card-premium card-hover p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-rise">
      {/* Supplier identity */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-b from-olive-500 to-olive-700 border border-olive-800/50 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-8px_rgba(60,69,37,0.65)] shrink-0">
          <Building2 className="w-7 h-7 text-cream-50" />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display text-[1.55rem] leading-tight font-semibold text-espresso tracking-tight">
              {report.supplier_name}
            </h2>
            {report.assessment_state === 'ASSESSED' && (
              <span className="badge-success">
                <ShieldCheck className="w-3 h-3" /> Assessed
              </span>
            )}
            {report.assessment_state === 'PROVISIONAL' && (
              <span className="badge-warning">
                Provisional Assessment
              </span>
            )}
            {report.assessment_state === 'NOT_ASSESSABLE' && (
              <span className="badge-danger">
                Not Assessable
              </span>
            )}
            {report.is_evidence_grounded && (
              <span className="badge-info">
                Evidence Grounded
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 mt-2.5 text-xs text-brown-600">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brass" />
              <span>Evidence Coverage: <strong className="text-espresso font-mono">{report.evidence_coverage}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brass" />
              <span>Confidence: <strong className="text-espresso font-mono">{report.assessment_confidence}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brass" />
              <span>Docs on file: <strong className="text-espresso">{report.document_count}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-stonewarm">Rule ver:</span>
              <span className="font-mono text-espresso">{report.rule_version || 'v2.0.0'}</span>
            </div>
          </div>
          {report.provisional_reason && (
            <p className="mt-2 text-xs text-terracotta bg-cream-150 border border-sand-300 rounded px-2 py-1 max-w-xl">
              {report.provisional_reason}
            </p>
          )}
        </div>
      </div>

      {/* Composite trust gauge */}
      <div className="flex items-center gap-5 bg-cream-100 border border-cream-300 px-6 py-4 rounded-2xl shrink-0 shadow-panel">
        <div className="relative w-[104px] h-[104px] flex items-center justify-center">
          <svg className="w-[104px] h-[104px] -rotate-90">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={stroke} />
                <stop offset="100%" stopColor={isAssessable ? '#B9975B' : '#C8BFAC'} />
              </linearGradient>
            </defs>
            <circle cx="52" cy="52" r={radius} stroke="#E7DCC3" strokeWidth="8" fill="transparent" />
            <circle
              cx="52"
              cy="52"
              r={radius}
              stroke="url(#gaugeGrad)"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[1.7rem] leading-none font-semibold text-espresso">
              {score !== null ? score : 'N/A'}
            </span>
            <span className="text-[9.5px] text-stonewarm uppercase tracking-[0.16em] font-semibold mt-0.5">
              {score !== null ? '/ 100' : 'NO SCORE'}
            </span>
          </div>
        </div>

        <div>
          <span className="section-label">Trust Assessment</span>
          <div className={`mt-1.5 badge px-3 py-1 text-xs ${
            !isAssessable ? 'bg-cream-300 text-espresso border border-sand-400'
            : level === 'LOW' ? 'badge-success' : level === 'MEDIUM' ? 'badge-warning' : 'badge-danger'
          }`}>
            {report.risk_level} RISK
          </div>
          <p className="text-[11px] text-brown-600 mt-1.5 max-w-[150px] leading-snug">
            {report.assessment_state === 'NOT_ASSESSABLE'
              ? 'Insufficient evidence to compute trust score'
              : report.assessment_state === 'PROVISIONAL'
              ? 'Provisional score: review recommended'
              : 'Manual review recommended before PO release'}
          </p>
        </div>
      </div>
    </div>
  );
};
