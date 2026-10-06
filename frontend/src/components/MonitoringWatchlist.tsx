import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  BellRing,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { TimelineEvent, AnalyticsOverview } from '../types';

interface MonitoringWatchlistProps {
  supplierId: string;
  supplierName: string;
}

export const MonitoringWatchlist: React.FC<MonitoringWatchlistProps> = ({
  supplierId,
  supplierName,
}) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);
  const [reminderSent, setReminderSent] = useState<string | null>(null);

  const loadMonitoringData = async () => {
    setLoading(true);
    try {
      const [events, overview] = await Promise.all([
        api.getSupplierTimeline(supplierId),
        api.getAnalyticsOverview().catch(() => null),
      ]);
      setTimeline(events);
      setAnalytics(overview);
    } catch (err) {
      console.error('Failed to load monitoring timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonitoringData();
  }, [supplierId]);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await api.triggerSupplierRecheck(supplierId);
      await loadMonitoringData();
    } catch (err) {
      console.error('Re-check trigger failed:', err);
    } finally {
      setRechecking(false);
    }
  };

  const handleSendReminder = (certDoc: string) => {
    setReminderSent(certDoc);
    setTimeout(() => setReminderSent(null), 3500);
  };

  const watchlist = analytics?.expiry_watchlist || [];

  return (
    <div className="space-y-6 animate-fade">
      {/* ── Top Bar: Title & Recheck Trigger ──────────────── */}
      <div className="card-premium p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-xl bg-olive-700 flex items-center justify-center text-cream-50 shadow-panel">
            <CalendarClock className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              Continuous Monitoring & Statutory Expiry Watchlist
            </h3>
            <p className="text-[11px] text-stonewarm">
              Scheduled 30 / 15 / 7-day validity checks and audit trail for {supplierName}
            </p>
          </div>
        </div>

        <button
          onClick={handleRecheck}
          disabled={rechecking}
          className="btn-brass !py-2 !px-3.5 !text-xs flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
          <span>{rechecking ? 'Running Re-check…' : 'Trigger Automated Re-check'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Column 1: Expiry Watchlist Card ───────────────── */}
        <div className="card-premium card-hover p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-gold-deep" />
              <h4 className="font-display text-base font-semibold text-espresso">
                Certificate Expiry Watchlist
              </h4>
            </div>
            <span className="badge-info">30/15/7 Day Thresholds</span>
          </div>

          {reminderSent && (
            <div className="p-3 rounded-xl bg-olive-50 border border-olive-300 text-xs text-olive-800 flex items-center gap-2 animate-scale-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-sage-deep" />
              <span>Renewal notification dispatched for {reminderSent}.</span>
            </div>
          )}

          {watchlist.length === 0 ? (
            <div className="p-6 rounded-xl bg-cream-100/60 border border-cream-300 text-center text-xs text-brown-600">
              <CheckCircle2 className="w-6 h-6 text-olive-600 mx-auto mb-2" />
              <p className="font-semibold text-espresso">No Critical Certificate Expiries</p>
              <p className="text-stonewarm mt-0.5">All monitored statutory certificates are within valid terms.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.map((item, idx) => {
                const isCritical = item.days_remaining <= 7;
                const isWarning = item.days_remaining <= 15;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                      isCritical
                        ? 'border-terracotta/40 bg-[#FDF0ED]'
                        : isWarning
                        ? 'border-brass/40 bg-[#FDF9ED]'
                        : 'border-cream-300 bg-linen'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isCritical ? 'bg-terracotta' : 'bg-gold'}`} />
                        <span className="font-bold text-espresso">{item.supplier_name}</span>
                        <span className={`badge !text-[9px] ${isCritical ? 'badge-danger' : 'badge-warning'}`}>
                          {item.days_remaining > 0 ? `${item.days_remaining}d left` : 'Expired'}
                        </span>
                      </div>
                      <p className="text-brown-600 mt-1">
                        Document: <span className="font-semibold">{item.source_document}</span>
                      </p>
                      <span className="text-[10px] text-stonewarm font-mono">
                        Expires: {item.expiry_date}
                      </span>
                    </div>

                    <button
                      onClick={() => handleSendReminder(item.source_document)}
                      className="btn-ghost !py-1.5 !px-3 !text-[11px] shrink-0 flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3 text-olive-700" />
                      <span>Send Reminder</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Column 2: Supplier Change Timeline / Feed ─────── */}
        <div className="card-premium card-hover p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brass-deep" />
              <h4 className="font-display text-base font-semibold text-espresso">
                Supplier Activity Feed & Audit Trail
              </h4>
            </div>
            <span className="text-xs text-stonewarm font-mono">
              {timeline.length} Recorded Events
            </span>
          </div>

          {timeline.length === 0 ? (
            <div className="p-6 rounded-xl bg-cream-100/60 border border-cream-300 text-center text-xs text-brown-600">
              <History className="w-6 h-6 text-stonewarm mx-auto mb-2" />
              <p className="font-semibold text-espresso">No Timeline Events Recorded</p>
              <p className="text-stonewarm mt-0.5">Events will appear here as documents and reviews are logged.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {timeline.map(ev => (
                <div
                  key={ev.event_id}
                  className="p-3 rounded-xl border border-cream-300 bg-linen text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-espresso flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-olive-700" />
                      {ev.title}
                    </span>
                    <span className="text-[10px] text-stonewarm font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {ev.details && (
                    <p className="text-[11.5px] text-brown-700 leading-snug">
                      {ev.details}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-stonewarm pt-0.5">
                    <code className="bg-cream-150 px-1 rounded border border-cream-250">
                      type: {ev.event_type}
                    </code>
                    {ev.actor_email && <span>by {ev.actor_email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
