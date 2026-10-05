import React from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  procurement_officer: 'Procurement',
  reviewer: 'Reviewer',
  admin: 'Admin',
};

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-[#233252] bg-[#111827]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">VendorGuard</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">AI</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Verify the Supplier. Verify the Evidence. Verify the AI.</p>
          </div>
        </div>

        {/* Feature Badges from Poster */}
        <div className="hidden lg:flex items-center gap-2">
          {['Document AI', 'LLMs', 'Risk Modelling', 'Graph Intelligence', 'Hallucination Detection', 'AI Analyst'].map((tag, idx) => (
            <span key={idx} className="text-[11px] px-2.5 py-1 rounded-md bg-[#1e293b] border border-[#334155] text-slate-300 font-medium">
              {tag}
            </span>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 bg-[#131b2e] p-1 rounded-lg border border-[#233252]">
            {[
              { id: 'dashboard', label: 'Scorecard Report' },
              { id: 'graph', label: 'Graph Explorer' },
              { id: 'chat', label: 'AI Analyst Chat' },
              { id: 'compare', label: 'Compare Suppliers' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a243d]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Session chip */}
          {user && (
            <div className="flex items-center gap-2 bg-[#131b2e] border border-[#233252] rounded-lg px-2.5 py-1.5">
              <div className="text-right leading-tight">
                <div className="text-[11px] font-semibold text-slate-200">{user.name}</div>
                <div className="text-[10px] text-blue-400 font-medium">{ROLE_LABELS[user.role] || user.role}</div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
