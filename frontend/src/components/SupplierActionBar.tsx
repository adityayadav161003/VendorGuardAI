import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Search,
  Plus,
  Download,
  FileJson,
  RefreshCw,
  Share2,
  ChevronDown,
  ShieldCheck,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Supplier, AnalysisReport } from '../types';

interface SupplierActionBarProps {
  suppliers: Supplier[];
  selectedSupplierId: string;
  onSelectSupplier: (id: string) => void;
  report: AnalysisReport | null;
  loading: boolean;
  onNewSupplierClick: () => void;
  onReanalyzeClick: () => void;
  onExport: (format: 'html' | 'json') => void;
  onInvitePortalClick: () => void;
}

export const SupplierActionBar: React.FC<SupplierActionBarProps> = ({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  report,
  loading,
  onNewSupplierClick,
  onReanalyzeClick,
  onExport,
  onInvitePortalClick,
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = suppliers.find(s => s.supplier_id === selectedSupplierId) || suppliers[0];

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.business_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.industry?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="card-premium p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 animate-rise shadow-panel">
      {/* Searchable Supplier Switcher */}
      <div className="flex items-center gap-3.5 w-full lg:w-auto">
        <div className="w-11 h-11 rounded-xl bg-olive-700 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_14px_-6px_rgba(60,69,37,0.6)] shrink-0">
          <Building2 className="w-5 h-5 text-cream-100" />
        </div>

        <div className="relative flex-1 sm:w-80" ref={searchRef}>
          <div className="flex items-center justify-between">
            <span className="section-label">Active Supplier Review</span>
            <span className="text-[10px] text-stonewarm font-mono">press / to search</span>
          </div>

          <button
            type="button"
            id="supplier-switcher-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            className="mt-1 w-full flex items-center justify-between input-premium !py-2 !px-3 text-sm font-semibold cursor-pointer text-left"
          >
            <span className="truncate">
              {selectedSupplier ? `${selectedSupplier.name}` : 'Select a Supplier…'}
            </span>
            <ChevronDown className="w-4 h-4 text-stonewarm shrink-0 ml-2" />
          </button>

          {/* Search Dropdown */}
          {searchOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-cream-50 border border-cream-300 rounded-xl shadow-2xl z-50 p-2 animate-scale-in max-h-72 flex flex-col">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-cream-100 rounded-lg border border-cream-300 mb-2">
                <Search className="w-3.5 h-3.5 text-stonewarm" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search suppliers by name or industry…"
                  className="bg-transparent border-0 text-xs text-espresso focus:outline-none w-full"
                />
              </div>

              <div className="overflow-y-auto space-y-1 flex-1">
                {filteredSuppliers.length === 0 ? (
                  <p className="text-xs text-stonewarm text-center py-4">No matching suppliers found.</p>
                ) : (
                  filteredSuppliers.map(s => (
                    <button
                      key={s.supplier_id}
                      onClick={() => {
                        onSelectSupplier(s.supplier_id);
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        s.supplier_id === selectedSupplierId
                          ? 'bg-olive-100 text-olive-900 font-semibold'
                          : 'hover:bg-cream-150 text-espresso'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-[10px] text-stonewarm">{s.industry || s.business_type}</div>
                      </div>
                      <span className={`badge !text-[9px] ${
                        s.status === 'VERIFIED' ? 'badge-success'
                        : s.status === 'FLAGGED' ? 'badge-danger'
                        : 'badge-info'
                      }`}>
                        {s.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
        <button
          onClick={onNewSupplierClick}
          className="btn-primary !py-2 !px-3.5 !text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Supplier</span>
        </button>

        <button
          onClick={onInvitePortalClick}
          className="btn-ghost !py-2 !px-3 !text-xs"
          title="Send self-service upload invite to supplier"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Invite Portal</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="btn-ghost !py-2 !px-3 !text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-stonewarm" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-cream-50 border border-cream-300 rounded-xl shadow-xl z-50 p-1.5 animate-scale-in space-y-1">
              <button
                onClick={() => {
                  onExport('html');
                  setExportOpen(false);
                }}
                className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 hover:bg-cream-150 text-espresso cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-olive-700" />
                <div>
                  <span className="font-semibold block">Print / PDF Report</span>
                  <span className="text-[10px] text-stonewarm">Print-ready dossier</span>
                </div>
              </button>
              <button
                onClick={() => {
                  onExport('json');
                  setExportOpen(false);
                }}
                className="w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 hover:bg-cream-150 text-espresso cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-brass-deep" />
                <div>
                  <span className="font-semibold block">JSON Dossier</span>
                  <span className="text-[10px] text-stonewarm">Raw API provenance</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onReanalyzeClick}
          disabled={loading}
          className="btn-brass !py-2 !px-3.5 !text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Re-run Analysis</span>
        </button>
      </div>
    </div>
  );
};
