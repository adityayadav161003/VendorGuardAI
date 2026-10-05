import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface DocumentDrawerProps {
  supplierId: string;
  onUploadSuccess: () => void;
}

export const DocumentDrawer: React.FC<DocumentDrawerProps> = ({ supplierId, onUploadSuccess }) => {
  const [docType, setDocType] = useState('GST');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      await api.uploadDocument(supplierId, docType, file);
      setMessage({ type: 'success', text: `Successfully uploaded and extracted ${file.name}` });
      setFile(null);
      onUploadSuccess();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card-premium card-hover p-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-8 h-8 rounded-lg bg-olive-700 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <Upload className="w-4 h-4 text-cream-50" />
        </span>
        <h3 className="font-display text-lg font-semibold text-espresso">Upload Supplier Documents</h3>
      </div>
      <p className="text-xs text-brown-600 mb-5 max-w-2xl">
        Supports PDF, images, and text filings. Extracts tax identifiers, dates, and bank details
        with page-level provenance. Unreadable scans are flagged for manual review — never scored as healthy.
      </p>

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 block mb-1.5">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="input-premium cursor-pointer"
            >
              <option value="GST">GST Registration Certificate</option>
              <option value="PAN">PAN Card</option>
              <option value="INCORPORATION">Certificate of Incorporation (MCA)</option>
              <option value="BANK_STATEMENT">Bank Statement / Cancelled Cheque</option>
              <option value="ISO_CERT">ISO / Compliance Certificate</option>
              <option value="INVOICE">Sample Invoice / Contract</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 block mb-1.5">Select File</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full rounded-xl bg-cream-50 border border-cream-300 px-3 py-2 text-xs text-brown-700
                file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold
                file:bg-olive-700 file:text-cream-50 hover:file:bg-olive-600 file:cursor-pointer file:transition-colors cursor-pointer"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="btn-primary w-full py-2.5"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>{uploading ? 'Parsing & Extracting Fields…' : 'Process Document with Document AI'}</span>
        </button>

        {message && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2.5 border animate-scale-in ${
            message.type === 'success'
              ? 'bg-olive-50 text-olive-800 border-olive-300'
              : 'bg-[#F6E3DA] text-terracotta-deep border-terracotta/40'
          }`}>
            {message.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}
      </form>
    </div>
  );
};
