import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ShieldAlert, FileText, Activity, CalendarClock, Gavel } from 'lucide-react';
import { AnalyticsOverview } from '../types';
import { api } from '../services/api';
import { CountUp } from './CountUp';

/** Donut chart for the risk distribution. */
const Donut: React.FC<{ dist: { LOW: number; MEDIUM: number; HIGH: number } }> = ({ dist }) => {
  const total = Math.max(1, dist.LOW + dist.MEDIUM + dist.HIGH);
  const segments = [
    { label: 'LOW', value: dist.LOW, color: '#77854A' },
    { label: 'MEDIUM', value: dist.MEDIUM, color: '#C29B4A' },
    { label: 'HIGH', value: dist.HIGH, color: '#B0563A' },
  ];
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="w-36 h-36 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#E7DCC3" strokeWidth="16" />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * C;
          const el = (
            <motion.circle
              key={i}
              cx="70" cy="70" r={R} fill="none"
              stroke={seg.color} strokeWidth="16" strokeLinecap="butt"
              strokeDasharray={`${dash} ${C - dash}`}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: -offset }}
              transition={{ duration: 1, delay: 0.3 + i * 0.2, ease: [0.22, 1, 0.36, 1] }}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="space-y-2">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2.5 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
            <span className="text-brown-700 font-medium w-16">{s.label}</span>
            <span className="font-mono font-bold text-espresso">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Horizontal animated bars for the six-vector portfolio averages. */
const VectorBars: React.FC<{ averages: Record<string, number | null> }> = ({ averages }) => {
  const entries = Object.entries(averages).filter(([, v]) => v !== null) as Array<[string, number]>;
  return (
    <div className="space-y-3">
      {entries.map(([key, val], i) => (
        <div key={key}>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-brown-700 font-medium capitalize">{key}</span>
            <span className="font-mono font-bold text-espresso">{val}</span>
          </div>
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(62,48,26,0.12)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-olive-500 to-olive-700"
              initial={{ width: 0 }}
              animate={{ width: `${val}%` }}
              transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export const CommandCenter: React.FC = () => {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAnalyticsOverview()
      .then(setData)
      .catch(err => setError(err.message));
  }, []);

  if (error) {
    return <div className="card-premium p-8 text-center text-terracotta-deep text-sm">{error}</div>;
  }
  if (!data) {
    return (
      <div className="card-premium p-16 text-center animate-fade">
        <Activity className="w-6 h-6 animate-spin text-olive-600 mx-auto" />
        <p className="font-display italic text-espresso mt-3">Assembling portfolio intelligence…</p>
      </div>
    );
  }

  const kpis = [
    { icon: Building2, label: 'Suppliers', value: data.totals.suppliers, suffix: '' },
    { icon: FileText, label: 'Documents on file', value: data.totals.documents, suffix: '' },
    { icon: Activity, label: 'Analyses run', value: data.totals.analyses_run, suffix: '' },
    { icon: ShieldAlert, label: 'Flagged / rejected', value: data.totals.flagged, suffix: '' },
  ];

  return (
    <div className="space-y-6 animate-fade">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="card-premium card-hover p-5"
          >
            <div className="flex items-center justify-between">
              <span className="w-9 h-9 rounded-lg bg-olive-700 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <k.icon className="w-4 h-4 text-cream-50" />
              </span>
              <span className="font-display text-[1.9rem] leading-none font-semibold text-espresso">
                <CountUp value={k.value} suffix={k.suffix} />
              </span>
            </div>
            <div className="section-label mt-3">{k.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk distribution + avg */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="card-premium card-hover p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-lg font-semibold text-espresso">Portfolio risk distribution</h3>
            {data.avg_risk !== null && (
              <span className="badge-warning">avg trust <CountUp value={data.avg_risk} decimals={1} /></span>
            )}
          </div>
          <Donut dist={data.risk_distribution} />
        </motion.div>

        {/* Vector averages */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="card-premium card-hover p-6"
        >
          <h3 className="font-display text-lg font-semibold text-espresso mb-5">Average vector health</h3>
          <VectorBars averages={data.vector_averages} />
        </motion.div>

        {/* Expiry watchlist */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.26 }}
          className="card-premium card-hover p-6"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-8 h-8 rounded-lg bg-[#F3E7C9] border border-brass/40 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-gold-deep" />
            </span>
            <h3 className="font-display text-lg font-semibold text-espresso">Certificate expiry watchlist</h3>
          </div>
          {data.expiry_watchlist.length === 0 ? (
            <p className="text-xs text-stonewarm">No expiry dates extracted yet — upload ISO or registration certificates.</p>
          ) : (
            <ul className="space-y-2">
              {data.expiry_watchlist.map((e, i) => {
                const urgent = e.days_remaining <= 60;
                const expired = e.days_remaining < 0;
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                      expired ? 'border-terracotta/40 bg-[#F6E3DA]'
                        : urgent ? 'border-brass/45 bg-[#F5ECD6]'
                        : 'border-olive-300/70 bg-olive-50'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-espresso">{e.supplier_name}</div>
                      <div className="text-stonewarm font-mono text-[10px] mt-0.5">{e.expiry_date} · {e.source_document}</div>
                    </div>
                    <span className={`badge ${expired ? 'badge-danger' : urgent ? 'badge-warning' : 'badge-success'}`}>
                      {expired ? `${-e.days_remaining}d overdue` : `${e.days_remaining}d left`}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </motion.div>

        {/* Claim health + top risk categories */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.34 }}
          className="card-premium card-hover p-6"
        >
          <h3 className="font-display text-lg font-semibold text-espresso mb-4">AI reliability</h3>
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E7DCC3" strokeWidth="12" />
                <motion.circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="#5F6D3B" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 40}
                  initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - (data.claim_health.support_rate || 0) / 100) }}
                  transition={{ duration: 1.1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display font-semibold text-espresso">
                  <CountUp value={data.claim_health.support_rate || 0} decimals={0} suffix="%" />
                </span>
                <span className="text-[8.5px] uppercase tracking-widest text-stonewarm font-semibold">supported</span>
              </div>
            </div>
            <div className="text-xs text-brown-700 leading-relaxed">
              <b className="text-espresso">{data.claim_health.supported}</b> of{' '}
              <b className="text-espresso">{data.claim_health.total}</b> AI claims were verified
              as SUPPORTED against cited evidence. The rest stay flagged for human review —
              by design.
            </div>
          </div>

          <span className="section-label block mb-2.5">Top risk categories</span>
          {data.top_risk_categories.length === 0 ? (
            <p className="text-xs text-stonewarm">No caution-level findings yet.</p>
          ) : (
            <div className="space-y-2">
              {data.top_risk_categories.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-brown-700 font-medium w-24">{c.category}</span>
                  <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-gold to-terracotta rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, c.count * 18)}%` }}
                      transition={{ duration: 0.7, delay: 0.5 + i * 0.08 }}
                    />
                  </div>
                  <span className="font-mono font-bold text-espresso">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent analyses trend */}
      {data.recent_analyses.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.42 }}
          className="card-premium card-hover p-6"
        >
          <h3 className="font-display text-lg font-semibold text-espresso mb-4">Recent analysis trend</h3>
          <svg viewBox={`0 0 ${Math.max(320, data.recent_analyses.length * 60)} 120`} className="w-full h-28">
            {(() => {
              const pts = data.recent_analyses.map((a, i) => {
                const x = 20 + i * ((Math.max(320, data.recent_analyses.length * 60) - 40) / Math.max(1, data.recent_analyses.length - 1));
                const y = 110 - (a.risk_score / 100) * 100;
                return `${x},${y}`;
              });
              return (
                <>
                  <motion.polyline
                    points={pts.join(' ')} fill="none" stroke="#5F6D3B" strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.4, ease: 'easeOut' }}
                  />
                  {pts.map((p, i) => {
                    const [x, y] = p.split(',');
                    const color = data.recent_analyses[i].risk_level === 'HIGH' ? '#B0563A'
                      : data.recent_analyses[i].risk_level === 'MEDIUM' ? '#C29B4A' : '#77854A';
                    return (
                      <motion.circle
                        key={i} cx={x} cy={y} r="4.5" fill={color}
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ delay: 0.7 + i * 0.08, type: 'spring', stiffness: 300 }}
                      />
                    );
                  })}
                </>
              );
            })()}
          </svg>
          <p className="text-[11px] text-stonewarm mt-2">
            Trust score per analysis run, oldest to newest — live from the analysis history table.
          </p>
        </motion.div>
      )}
    </div>
  );
};
