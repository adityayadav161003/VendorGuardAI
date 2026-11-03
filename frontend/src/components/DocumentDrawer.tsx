import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
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
    <div className="bg-[#131b2e] border border-[#233252] rounded-xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Upload className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          Upload Supplier Documents
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Supports PDF, images, and text filings. Extracts tax identifiers, dates, and bank details with page-level provenance.
      </p>

      <form onSubmit={handleUpload} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full bg-[#0d1424] border border-[#233252] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Select File</label>
            <input
              type="file"
              onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full bg-[#0d1424] border border-[#233252] rounded-lg px-3 py-1.5 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Parsing & Extracting Fields...' : 'Process Document with Document AI'}</span>
        </button>

        {message && (
          <div className={`p-2.5 rounded text-xs flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}
      </form>
    </div>
  );
};

// Document intake drawer
