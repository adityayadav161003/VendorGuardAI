import React, { useState } from 'react';
import { X, Share2, Copy, Check, Link, Mail, Calendar, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { PortalInvite } from '../types';

interface PortalInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
}

const AVAILABLE_DOCS = [
  'GST Registration Certificate',
  'PAN Card',
  'Certificate of Incorporation (MCA)',
  'Bank Statement / Cancelled Cheque',
  'ISO / Compliance Certificate',
  'Sample Invoice / Contract',
];

export const PortalInviteModal: React.FC<PortalInviteModalProps> = ({
  isOpen,
  onClose,
  supplierId,
  supplierName,
}) => {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([
    'GST Registration Certificate',
    'PAN Card',
    'Certificate of Incorporation (MCA)',
  ]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [generating, setGenerating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<PortalInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleDoc = (doc: string) => {
    setSelectedDocs(prev =>
      prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]
    );
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const invite = await api.createPortalInvite(supplierId, {
        recipient_email: recipientEmail.trim() || undefined,
        required_documents: selectedDocs,
        expires_in_days: expiryDays,
      });
      setCreatedInvite(invite);
    } catch (err: any) {
      setError(err.message || 'Failed to generate portal invite');
    } finally {
      setGenerating(false);
    }
  };

  const inviteUrl = createdInvite
    ? `${window.location.origin}/portal/${createdInvite.invite_token}`
    : '';

  const copyToClipboard = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-espresso/60 backdrop-blur-xs transition-opacity animate-fade"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-cream-50 rounded-2xl shadow-2xl border border-cream-300 p-6 z-10 animate-scale-in space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-cream-300">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-olive-700 flex items-center justify-center text-cream-50">
              <Share2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-espresso">
                Supplier Intake Portal Invite
              </h3>
              <p className="text-[11px] text-stonewarm font-body">
                Issue tokenized self-service upload link for {supplierName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stonewarm hover:text-espresso hover:bg-cream-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {createdInvite ? (
          <div className="space-y-4 animate-fade">
            <div className="p-4 rounded-xl bg-olive-50 border border-olive-300 text-xs text-olive-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-olive-800">
                <ShieldCheck className="w-4 h-4 text-sage-deep" />
                <span>Portal Link Generated Successfully</span>
              </div>
              <p className="text-[11.5px] leading-relaxed">
                This tokenized link expires on {new Date(createdInvite.expires_at).toLocaleDateString()}.
                The supplier can upload required filings directly without accessing internal scores or reviews.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-brown-600 block mb-1">
                Shareable Intake URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="input-premium text-xs font-mono !py-2 flex-1 select-all"
                />
                <button
                  onClick={copyToClipboard}
                  className="btn-primary !py-2 !px-3 !text-xs flex items-center gap-1.5 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button onClick={onClose} className="btn-ghost !text-xs">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-brown-600 block mb-1">
                Supplier Contact Email (Optional)
              </label>
              <div className="flex items-center gap-2 bg-cream-100 rounded-xl border border-cream-300 px-3 py-2 text-xs">
                <Mail className="w-4 h-4 text-stonewarm" />
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="procurement@supplier.com"
                  className="bg-transparent border-0 text-espresso w-full focus:outline-none text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-brown-600 block mb-1.5">
                Checklist of Required Document Types
              </label>
              <div className="space-y-1.5">
                {AVAILABLE_DOCS.map(doc => {
                  const checked = selectedDocs.includes(doc);
                  return (
                    <label
                      key={doc}
                      className={`p-2 rounded-lg border text-xs flex items-center gap-2.5 cursor-pointer transition-colors ${
                        checked ? 'border-olive-400 bg-olive-50 font-medium' : 'border-cream-300 bg-linen'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDoc(doc)}
                        className="accent-olive-700 rounded"
                      />
                      <span>{doc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-brown-600 block mb-1">
                Token Expiration Window
              </label>
              <select
                value={expiryDays}
                onChange={e => setExpiryDays(Number(e.target.value))}
                className="input-premium text-xs cursor-pointer"
              >
                <option value={3}>3 Days</option>
                <option value={7}>7 Days (Recommended)</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            {error && (
              <p className="text-xs text-terracotta-deep bg-[#F6E3DA] p-2.5 rounded-lg border border-terracotta/40">
                {error}
              </p>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost !text-xs">
                Cancel
              </button>
              <button
                type="submit"
                disabled={generating || selectedDocs.length === 0}
                className="btn-primary !py-2 !px-4 !text-xs flex items-center gap-1.5"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                <span>{generating ? 'Generating…' : 'Generate Tokenized Link'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
