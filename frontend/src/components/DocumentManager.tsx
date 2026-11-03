import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Eye,
  FileCheck,
  Tag,
  Hash,
} from 'lucide-react';
import { api } from '../services/api';
import { ExtractedEntityItem, PipelineJob } from '../types';

interface DocumentManagerProps {
  supplierId: string;
  onUploadSuccess: () => void;
}

const PIPELINE_STAGES = [
  { key: 'UPLOAD', label: 'Uploaded' },
  { key: 'VALIDATE', label: 'Safety Check' },
  { key: 'OCR', label: 'OCR Scan' },
  { key: 'EXTRACT', label: 'Entity Extract' },
  { key: 'NORMALISE', label: 'Normalise' },
  { key: 'CHECKS', label: 'Consistency' },
  { key: 'ASSESS', label: 'Risk Assess' },
  { key: 'REPORT', label: 'Report Ready' },
];

export const DocumentManager: React.FC<DocumentManagerProps> = ({ supplierId, onUploadSuccess }) => {
  const [docType, setDocType] = useState('GST');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Extracted entities view
  const [entities, setEntities] = useState<ExtractedEntityItem[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'entities'>('upload');

  // Pipeline job state
  const [activeJob, setActiveJob] = useState<PipelineJob | null>(null);
  const pollingRef = useRef<number | null>(null);

  const loadEntities = async () => {
    setLoadingEntities(true);
    try {
      const data = await api.getExtractedEntities(supplierId);
      setEntities(data);
    } catch {
      setEntities([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  useEffect(() => {
    loadEntities();
  }, [supplierId]);

  // Clean up polling
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollJobStatus = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = window.setInterval(async () => {
      try {
        const job = await api.getPipelineJob(jobId);
        setActiveJob(job);
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (job.status === 'COMPLETED') {
            loadEntities();
            onUploadSuccess();
          }
        }
      } catch {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    }, 1500);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadProgress(20);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setUploadProgress(50);
      await api.uploadDocument(supplierId, docType, file);
      setUploadProgress(85);

      // Trigger async pipeline job
      try {
        const job = await api.startPipelineJob(supplierId);
        setActiveJob(job);
        pollJobStatus(job.job_id);
      } catch {
        // Fallback: reload directly
      }

      setUploadProgress(100);
      setSuccessMessage(`Document ${file.name} uploaded and routed through verification pipeline.`);
      setFile(null);
      await loadEntities();
      onUploadSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload rejected due to validation failure.');
    } finally {
      setUploading(false);
    }
  };

  const currentStageIndex = activeJob
    ? PIPELINE_STAGES.findIndex(s => s.key === activeJob.current_stage)
    : -1;

  return (
    <div className="card-premium card-hover p-6 space-y-6">
      {/* ── Header & Subtabs ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-olive-700 flex items-center justify-center text-cream-50 shadow-panel">
            <Upload className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-espresso">
              Document Intake & Pipeline Stepper
            </h3>
            <p className="text-[11px] text-stonewarm">
              Upload statutory filings with file-safety checks, OCR, and provenance extraction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-cream-150 p-1 rounded-xl border border-cream-300">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'upload' ? 'bg-espresso text-cream-50' : 'text-brown-700 hover:text-espresso'
            }`}
          >
            Upload Filing
          </button>
          <button
            onClick={() => setActiveTab('entities')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'entities' ? 'bg-espresso text-cream-50' : 'text-brown-700 hover:text-espresso'
            }`}
          >
            <Tag className="w-3 h-3" />
            Extracted Fields ({entities.length})
          </button>
        </div>
      </div>

      {/* ── Tab 1: Upload Form & Stepper ──────────────────── */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              isDragging
                ? 'border-olive-600 bg-olive-50/60 scale-[1.01]'
                : file
                ? 'border-brass bg-[#FAF5EB]'
                : 'border-cream-300 bg-cream-50/70 hover:border-olive-500/70 hover:bg-cream-100/50'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <span className="w-12 h-12 rounded-2xl bg-cream-150 border border-cream-300 flex items-center justify-center text-olive-700 shadow-xs">
                <FileCheck className="w-6 h-6" />
              </span>

              {file ? (
                <div>
                  <p className="font-semibold text-espresso text-sm">{file.name}</p>
                  <p className="text-xs text-stonewarm font-mono mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB · Ready to process
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-espresso text-sm">
                    Drag and drop statutory filing here, or click to browse
                  </p>
                  <p className="text-xs text-stonewarm mt-1">
                    Accepts PDF, PNG, JPG, or TXT (Max 15MB) · Magic bytes verified
                  </p>
                </div>
              )}

              <input
                type="file"
                id="doc-file-input"
                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                className="hidden"
              />
              <label
                htmlFor="doc-file-input"
                className="btn-ghost !py-1.5 !px-3.5 !text-xs cursor-pointer inline-block"
              >
                Browse Local File
              </label>
            </div>
          </div>

          {/* Document Type Selector & Upload CTA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 block mb-1.5">
                Statutory Document Type
              </label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="input-premium cursor-pointer text-xs"
              >
                <option value="GST">GST Registration Certificate</option>
                <option value="PAN">PAN Card</option>
                <option value="INCORPORATION">Certificate of Incorporation (MCA)</option>
                <option value="BANK_STATEMENT">Bank Statement / Cancelled Cheque</option>
                <option value="ISO_CERT">ISO / Compliance Certificate</option>
                <option value="INVOICE">Sample Invoice / Contract</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                onClick={() => handleUpload()}
                disabled={!file || uploading}
                className="btn-primary w-full !py-2.5 !text-xs flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Document AI Pipeline ({uploadProgress}%)…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Execute Verification Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[#F6E3DA] border border-terracotta/40 text-xs text-terracotta-deep flex items-start gap-2.5 animate-scale-in">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>File Safety Rejection: </strong>
                {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-olive-50 border border-olive-300 text-xs text-olive-800 flex items-center gap-2.5 animate-scale-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ── 8-Stage Pipeline Stepper ────────────────────── */}
          {activeJob && (
            <div className="p-5 rounded-2xl bg-linen border border-cream-300 space-y-4 animate-rise">
              <div className="flex items-center justify-between">
                <div>
                  <span className="section-label">Pipeline Stepper</span>
                  <h4 className="font-semibold text-xs text-espresso mt-0.5">
                    Job ID: <span className="font-mono text-stonewarm">{activeJob.job_id}</span>
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge !text-[10px] ${
                    activeJob.status === 'COMPLETED' ? 'badge-success'
                    : activeJob.status === 'FAILED' ? 'badge-danger'
                    : 'badge-warning'
                  }`}>
                    {activeJob.status} ({activeJob.progress_percent}%)
                  </span>
                  {activeJob.status === 'FAILED' && (
                    <button
                      onClick={async () => {
                        const retried = await api.retryPipelineJob(activeJob.job_id);
                        setActiveJob(retried);
                        pollJobStatus(retried.job_id);
                      }}
                      className="btn-brass !py-1 !px-2.5 !text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Stage
                    </button>
                  )}
                </div>
              </div>

              {/* Stepper bar */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2"
                role="status"
                aria-live="polite"
                aria-label={`Pipeline stage: ${activeJob.current_stage || 'queued'}`}
              >
                {PIPELINE_STAGES.map((stg, i) => {
                  const isDone = currentStageIndex > i || activeJob.status === 'COMPLETED';
                  const isCurrent = activeJob.current_stage === stg.key && activeJob.status !== 'COMPLETED';
                  const isFailed = activeJob.status === 'FAILED' && activeJob.current_stage === stg.key;

                  return (
                    <div
                      key={stg.key}
                      className={`p-2.5 rounded-xl border text-center text-xs transition-all ${
                        isDone
                          ? 'border-olive-400 bg-olive-50 text-olive-900 font-semibold'
                          : isCurrent
                          ? 'border-brass bg-[#FAF0D9] text-gold-deep font-bold animate-pulse'
                          : isFailed
                          ? 'border-terracotta bg-[#FDF0ED] text-terracotta-deep font-bold'
                          : 'border-cream-300 bg-cream-50 text-stonewarm'
                      }`}
                    >
                      <span className="block text-[10px] font-mono text-stonewarm mb-0.5">
                        Step {i + 1}
                      </span>
                      <span className="block text-[11px] leading-tight truncate">
                        {stg.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Timing info */}
              {activeJob.stage_timings && Object.keys(activeJob.stage_timings).length > 0 && (
                <div className="flex items-center gap-3 text-[10.5px] text-stonewarm font-mono pt-1">
                  <span>Stage Timings:</span>
                  {Object.entries(activeJob.stage_timings).map(([stage, secs]) => (
                    <span key={stage} className="bg-cream-150 px-1.5 py-0.5 rounded border border-cream-250">
                      {stage}: {secs}s
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Extracted Fields Drawer ───────────────── */}
      {activeTab === 'entities' && (
        <div className="space-y-4 animate-fade">
          <div className="flex items-center justify-between">
            <span className="section-label">Field Extraction with Provenance & Confidence</span>
            <button onClick={loadEntities} className="btn-ghost !py-1 !px-2.5 !text-xs">
              <RefreshCw className={`w-3 h-3 ${loadingEntities ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {entities.length === 0 ? (
            <p className="text-xs text-stonewarm text-center py-8">
              No entities extracted yet. Upload a GST certificate, PAN card, or invoice to extract fields.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entities.map(ent => (
                <div
                  key={ent.id}
                  className="p-3.5 rounded-xl border border-cream-300 bg-linen text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-olive-800 text-[11px] bg-olive-100 px-2 py-0.5 rounded border border-olive-300">
                      {ent.entity_type}
                    </span>
                    <span className="font-mono text-[10.5px] text-brown-600">
                      Confidence: <strong>{(ent.confidence * 100).toFixed(0)}%</strong>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stonewarm uppercase tracking-wide block">Value</span>
                    <span className="font-mono font-bold text-espresso text-sm break-all">
                      {ent.entity_value}
                    </span>
                  </div>

                  <div className="text-[11px] text-brown-600 bg-cream-100 p-2 rounded border border-cream-250">
                    <span className="text-stonewarm block text-[10px]">Snippet in {ent.document_name} (Page {ent.page_number}):</span>
                    <span className="italic font-mono text-[10.5px]">"{ent.snippet || 'Found on page'}"</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
