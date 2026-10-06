import React, { useState, useEffect } from 'react';
import {
  Upload,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  Loader2,
  Lock,
  Building2,
  Calendar,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { PortalViewData } from '../types';
import { Crest } from '../components/Brand';

interface SupplierPortalPageProps {
  token: string;
  onExit?: () => void;
}

export const SupplierPortalPage: React.FC<SupplierPortalPageProps> = ({ token, onExit }) => {
  const [data, setData] = useState<PortalViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload states
  const [selectedDocType, setSelectedDocType] = useState<string>('GST');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPortalView(token);
      setData(res);
      if (res.required_documents.length > 0) {
        setSelectedDocType(res.required_documents[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to access supplier intake portal. Token may have expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [token]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadProgress(30);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      setUploadProgress(65);
      await api.uploadPortalDocument(token, selectedDocType, file);
      setUploadProgress(100);
      setUploadSuccess(`Successfully uploaded ${file.name} for ${selectedDocType} verification.`);
      setFile(null);
      await loadPortalData();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please ensure the file is under 15MB.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="card-premium p-8 max-w-md w-full text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-olive-600 mx-auto" />
          <h3 className="font-display text-lg font-semibold text-espresso">
            Verifying Supplier Portal Token…
          </h3>
          <p className="text-xs text-brown-600">
            Connecting to secure procurement repository
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="card-premium p-8 max-w-md w-full text-center space-y-4 border-terracotta/40">
          <AlertCircle className="w-10 h-10 text-terracotta-deep mx-auto" />
          <h3 className="font-display text-lg font-semibold text-espresso">
            Portal Link Expired or Invalid
          </h3>
          <p className="text-xs text-brown-600 leading-relaxed">
            {error || 'This tokenized document intake invite is no longer valid. Please contact your procurement officer to issue a fresh link.'}
          </p>
          {onExit && (
            <button onClick={onExit} className="btn-primary w-full !text-xs mt-2">
              Return to Application
            </button>
          )}
        </div>
      </div>
    );
  }

  const uploadedTypes = new Set(data.uploaded_documents.map(d => d.document_type));

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      {/* Header */}
      <header className="bg-espresso border-b border-brown-800 py-4 px-6 shadow-panel">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crest className="w-9 h-9" />
            <div>
              <span className="font-display text-lg font-semibold text-cream-100">
                VendorGuard Secure Supplier Portal
              </span>
              <p className="text-[10px] text-cream-300/60 font-body">
                Official Document Verification & Onboarding Intake
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-brass-light bg-espresso-light px-2.5 py-1 rounded-lg border border-brown-700">
            <Lock className="w-3 h-3 text-brass" /> 256-bit Encrypted
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {/* Supplier Banner */}
        <div className="card-premium p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-olive-700 flex items-center justify-center text-cream-50 shadow-panel">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="section-label">Onboarding Entity</span>
              <h2 className="font-display text-xl font-bold text-espresso">
                {data.supplier_name}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-brown-600">
                <Calendar className="w-3.5 h-3.5 text-brass" />
                <span>Link valid until: <strong>{new Date(data.expires_at).toLocaleDateString()}</strong></span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="badge-info">Supplier Self-Service</span>
            <p className="text-[10px] text-stonewarm mt-1">
              Internal risk metrics are not accessible from this upload terminal.
            </p>
          </div>
        </div>

        {/* Required Document Checklist */}
        <div className="card-premium p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-espresso">
              Required Compliance Documents Checklist
            </h3>
            <span className="text-xs text-stonewarm font-mono">
              {data.uploaded_documents.length} of {data.required_documents.length} filed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.required_documents.map(doc => {
              const isDone = uploadedTypes.has(doc);
              return (
                <div
                  key={doc}
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                    isDone
                      ? 'border-olive-300 bg-olive-50 text-olive-900 font-semibold'
                      : 'border-cream-300 bg-linen text-espresso'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-sage-deep shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-sand-400 bg-sand-200" />
                    )}
                    <span>{doc}</span>
                  </div>
                  <span className={`badge !text-[9.5px] ${isDone ? 'badge-success' : 'badge-warning'}`}>
                    {isDone ? 'Received' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upload Form */}
        <div className="card-premium p-6 space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold text-espresso">
              Upload Verification Document
            </h3>
            <p className="text-xs text-brown-600 mt-0.5">
              Upload statutory filings (PDF or image). Filings are parsed for statutory verification checksums.
            </p>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 block mb-1.5">
                  Document Type Being Uploaded
                </label>
                <select
                  value={selectedDocType}
                  onChange={e => setSelectedDocType(e.target.value)}
                  className="input-premium cursor-pointer text-xs"
                >
                  {data.required_documents.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="OTHER">Other Supplementary Document</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 block mb-1.5">
                  Choose Local File (Max 15MB)
                </label>
                <input
                  type="file"
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full rounded-xl bg-cream-50 border border-cream-300 px-3 py-2 text-xs text-brown-700
                    file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold
                    file:bg-olive-700 file:text-cream-50 hover:file:bg-olive-600 file:cursor-pointer cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!file || uploading}
              className="btn-primary w-full !py-2.5 !text-xs flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Encrypting & Uploading Document ({uploadProgress}%)…</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Submit Document to Procurement Officer</span>
                </>
              )}
            </button>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-[#F6E3DA] border border-terracotta/40 text-xs text-terracotta-deep flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3.5 rounded-xl bg-olive-50 border border-olive-300 text-xs text-olive-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}
          </form>
        </div>

        {/* Previously Uploaded Submissions */}
        {data.uploaded_documents.length > 0 && (
          <div className="card-premium p-6 space-y-3">
            <span className="section-label">Submitted Repository Records</span>
            <div className="space-y-2">
              {data.uploaded_documents.map(doc => (
                <div
                  key={doc.document_id}
                  className="p-3 rounded-xl border border-cream-300 bg-linen flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-olive-700" />
                    <div>
                      <span className="font-semibold text-espresso block">{doc.original_filename}</span>
                      <span className="text-[10px] text-stonewarm font-mono">
                        Type: {doc.document_type} · Submitted: {new Date(doc.uploaded_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className="badge-success !text-[10px]">Received & Filed</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-cream-300 bg-cream-200/60 py-4 text-center text-xs text-brown-600">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <span>VendorGuard AI Onboarding Portal</span>
          <span>Decision Support & Compliance Intake</span>
        </div>
      </footer>
    </div>
  );
};
