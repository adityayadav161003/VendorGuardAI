import React from 'react';
import { Building2, ShieldCheck, MapPin, Calendar, Layers } from 'lucide-react';
import { AnalysisReport } from '../types';

interface ScoreCardProps {
  report: AnalysisReport;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({ report }) => {
  const score = report.risk_score;
  const isMedium = report.risk_level === 'MEDIUM';
  const isLow = report.risk_level === 'LOW';
  
  // Circumference for circular gauge
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
      {/* Supplier Profile Info */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
          <Building2 className="w-7 h-7" />
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">{report.supplier_name}</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3 h-3" /> Verified GST
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 mt-2.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">GSTIN:</span>
              <span className="font-mono text-slate-200">09ABCDE1234F125</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Private Limited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Incorporation: 2017</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Noida, UP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Composite Risk Score Circular Gauge */}
      <div className="flex items-center gap-4 bg-[#0d1424] border border-[#1e293b] px-6 py-3.5 rounded-xl shrink-0">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-24 h-24 transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke="#1e293b"
              strokeWidth="7"
              fill="transparent"
            />
            <circle
              cx="48"
              cy="48"
              r={radius}
              stroke={isLow ? '#10b981' : isMedium ? '#f59e0b' : '#ef4444'}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white">{score}</span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">/ 100</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Trust Assessment</span>
          <div className={`mt-0.5 text-sm font-extrabold px-2.5 py-0.5 rounded-md inline-block ${
            isLow ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
            isMedium ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            'bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}>
            {report.risk_level} RISK
          </div>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[140px] leading-tight">
            Manual Review Recommended before PO release
          </p>
        </div>
      </div>
    </div>
  );
};

// Circular score gauge
