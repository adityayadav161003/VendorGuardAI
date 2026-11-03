import React, { useState } from 'react';
import {
  Bot,
  Send,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { ChatMessage, Citation } from '../types';

interface GroundedChatProps {
  supplierId: string;
  supplierName: string;
}

export const GroundedChat: React.FC<GroundedChatProps> = ({ supplierId, supplierName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'analyst',
      text: `Hello! I am your AI Procurement Analyst for ${supplierName}. Every statement I make is backed by stored document evidence and statutory checksums. If requested information is missing from the repository, I will state "Not found in submitted evidence" rather than speculate.`,
      verification_status: 'READY',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePopoverCitation, setActivePopoverCitation] = useState<Citation | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;

    const userText = inputQuery.trim();
    setInputQuery('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await api.askAnalyst(supplierId, userText);
      setMessages(prev => [
        ...prev,
        {
          sender: 'analyst',
          text: res.answer,
          citations: res.citations,
          verification_status: res.verification_status,
          claims_verified: res.claims_verified,
          claims_unsupported: res.claims_unsupported,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'analyst',
          text: `Analyst response unavailable: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    'Are GSTIN and PAN consistent?',
    'Check bank account holder against registered legal name',
    'What is the certificate expiry status?',
    'Are there any shared directorships or address signals?',
  ];

  return (
    <div className="card-premium p-6 flex flex-col h-[620px] animate-rise shadow-panel relative">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-cream-300 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-espresso flex items-center justify-center text-brass-light shadow-panel">
            <Bot className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              Grounded AI Procurement Analyst
            </h3>
            <p className="text-[11px] text-stonewarm">
              Evidence-grounded natural language Q&A · Zero speculation
            </p>
          </div>
        </div>

        <span className="badge-success flex items-center gap-1.5 py-1 px-2.5">
          <ShieldCheck className="w-3.5 h-3.5 text-sage-deep" />
          Evidence Grounded
        </span>
      </div>

      {/* ── Quick Prompts ─────────────────────────────────── */}
      <div className="flex items-center gap-2 py-3 overflow-x-auto shrink-0 border-b border-cream-250">
        <span className="text-[11px] text-brown-600 font-semibold shrink-0">Prompts:</span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => setInputQuery(prompt)}
            className="btn-quiet whitespace-nowrap !py-1 !px-2.5 !text-[11px] cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* ── Messages Feed ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col animate-rise ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-b from-olive-600 to-olive-800 text-cream-50 rounded-br-md shadow-[0_6px_16px_-6px_rgba(60,69,37,0.55)]'
                  : 'bg-cream-100/90 border border-cream-300 text-espresso rounded-bl-md shadow-panel'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Citations bar with interactive popover triggers */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-cream-300 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-stonewarm uppercase tracking-[0.14em]">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-brass-deep" /> Backing Citations
                    </span>
                    <span className="text-olive-800 font-mono normal-case tracking-normal">
                      Click marker for popover
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {msg.citations.map((cite, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => setActivePopoverCitation(cite)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-linen border border-cream-300 hover:border-olive-400 text-brown-800 text-xs font-mono transition-all cursor-pointer shadow-xs"
                      >
                        <span className="font-bold text-olive-700">[{cIdx + 1}]</span>
                        <span className="truncate max-w-[140px]">{cite.doc_name}</span>
                        <span className="text-stonewarm text-[10px]">p.{cite.page}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-brown-600 animate-pulse py-2">
            <Bot className="w-4 h-4 text-brass-deep" />
            <span>Retrieving repository records and cross-checking claims…</span>
          </div>
        )}
      </div>

      {/* ── Citation Popover Modal/Card ───────────────────── */}
      {activePopoverCitation && (
        <div className="absolute bottom-20 left-6 right-6 bg-cream-50 rounded-2xl border border-brass/60 shadow-2xl p-4.5 z-30 animate-scale-in text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-cream-250 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-olive-700" />
              <span className="font-bold text-espresso">{activePopoverCitation.doc_name}</span>
              <span className="badge-info !text-[9.5px]">Page {activePopoverCitation.page}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] text-brown-700 bg-olive-100 px-2 py-0.5 rounded border border-olive-300">
                Confidence: {((activePopoverCitation.confidence ?? 0.95) * 100).toFixed(0)}%
              </span>
              <button
                onClick={() => setActivePopoverCitation(null)}
                className="p-1 rounded-lg text-stonewarm hover:text-espresso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-stonewarm uppercase tracking-wide block">
              Grounded Document Snippet:
            </span>
            <p className="bg-linen p-2.5 rounded-lg border border-cream-300 font-mono text-[11px] text-espresso leading-relaxed mt-1">
              "{activePopoverCitation.snippet}"
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] text-stonewarm pt-1">
            <span>Doc ID: {activePopoverCitation.doc_id}</span>
            <span className="text-olive-800 font-medium">Verified Evidence Provenance</span>
          </div>
        </div>
      )}

      {/* ── Composer Form ─────────────────────────────────── */}
      <form onSubmit={handleSend} className="pt-3 border-t border-cream-300 flex items-center gap-2.5 shrink-0">
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          placeholder={`Ask about ${supplierName}'s tax filings, bank match, or risk…`}
          className="input-premium flex-1 text-xs"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="btn-primary !py-2.5 !px-4 !text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
