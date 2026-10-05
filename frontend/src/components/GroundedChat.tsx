import React, { useState } from 'react';
import { Bot, Send, ShieldCheck, FileText, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { ChatMessage } from '../types';

interface GroundedChatProps {
  supplierId: string;
  supplierName: string;
}

export const GroundedChat: React.FC<GroundedChatProps> = ({ supplierId, supplierName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'analyst',
      text: `Hello! I am your AI Procurement Analyst for ${supplierName}. All my answers are grounded in uploaded certificates, registry filings, and bank records with verifiable citations. Ask me anything about this supplier's risk profile!`,
      verification_status: 'READY'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

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
          claims_unsupported: res.claims_unsupported
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'analyst',
          text: `Error connecting to analyst service: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-premium p-6 flex flex-col h-[580px] animate-rise">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-cream-300 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Bot className="w-4 h-4 text-brass-light" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">Chat with Supplier Data</h3>
            <p className="text-[11px] text-stonewarm">Verifiable Answers with Source Citations</p>
          </div>
        </div>
        <span className="badge-success">
          <ShieldCheck className="w-3 h-3" /> Grounding Active
        </span>
      </div>

      {/* Quick prompts */}
      <div className="flex items-center gap-2 py-3 overflow-x-auto shrink-0">
        {[
          "Are the bank details consistent?",
          "Check GST and PAN registration",
          "What is the ISO certification status?",
          "Are there any shared directorships?"
        ].map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => setInputQuery(prompt)}
            className="btn-quiet whitespace-nowrap"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col animate-rise ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-b from-olive-500 to-olive-700 text-cream-50 rounded-br-md shadow-[0_6px_16px_-6px_rgba(60,69,37,0.55)]'
                  : 'bg-cream-100 border border-cream-300 text-espresso rounded-bl-md shadow-panel'
              }`}
            >
              <p>{msg.text}</p>

              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-cream-300 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold text-stonewarm uppercase tracking-[0.14em]">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-brass-deep" /> Evidence Citations
                    </span>
                    <span className="text-olive-700 font-mono normal-case tracking-normal">
                      {msg.claims_verified} claims verified
                    </span>
                  </div>
                  {msg.citations.map((cite, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-2.5 rounded-lg bg-linen border border-cream-300 text-[11px] font-mono text-brown-700"
                    >
                      <span className="text-olive-700 font-bold">[{cite.doc_name} • p.{cite.page}]</span> {cite.snippet}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-brown-600 animate-pulse-soft">
            <Bot className="w-4 h-4 text-brass-deep" />
            <span>Retrieving evidence and checking claims…</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="pt-4 border-t border-cream-300 flex items-center gap-2.5 shrink-0">
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          placeholder="Ask a question about this supplier…"
          className="input-premium flex-1"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="btn-primary !py-2.5"
        >
          <Send className="w-4 h-4" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
