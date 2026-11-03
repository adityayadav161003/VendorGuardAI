import React, { useState } from 'react';
import { Bot, Send, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
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
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg flex flex-col h-[560px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-[#233252] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Chat with Supplier Data</h3>
            <p className="text-[11px] text-slate-400">Verifiable Answers with Source Citations</p>
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Grounding Active
        </span>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex items-center gap-2 py-2 overflow-x-auto shrink-0">
        {[
          "Are the bank details consistent?",
          "Check GST and PAN registration",
          "What is the ISO certification status?",
          "Are there any shared directorships?"
        ].map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => setInputQuery(prompt)}
            className="text-[11px] px-2.5 py-1 rounded-md bg-[#0d1424] hover:bg-[#1e293b] border border-[#233252] text-slate-300 whitespace-nowrap transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-500/10'
                  : 'bg-[#0d1424] border border-[#1e293b] text-slate-200 rounded-bl-none'
              }`}
            >
              <p>{msg.text}</p>

              {/* Citations Box for Analyst Responses */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#1e293b] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-blue-400" /> Evidence Citations:
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {msg.claims_verified} claims verified
                    </span>
                  </div>
                  {msg.citations.map((cite, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-2 rounded bg-[#131b2e] border border-[#233252] text-[11px] font-mono text-slate-300"
                    >
                      <span className="text-blue-400 font-bold">[{cite.doc_name} • p.{cite.page}]</span> {cite.snippet}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
            <Bot className="w-4 h-4 text-blue-400" />
            <span>Retrieving evidence and checking claims...</span>
          </div>
        )}
      </div>

      {/* Input Field */}
      <form onSubmit={handleSend} className="pt-3 border-t border-[#233252] flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputQuery}
          onChange={e => setInputQuery(e.target.value)}
          placeholder="Ask a question about this supplier..."
          className="flex-1 bg-[#0d1424] border border-[#233252] rounded-lg px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};

// Grounded chat
