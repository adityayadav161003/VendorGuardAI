import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Crest } from './Brand';

const ROLE_LABELS: Record<string, string> = {
  procurement_officer: 'Procurement',
  reviewer: 'Reviewer',
  admin: 'Administrator',
};

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TABS = [
  { id: 'dashboard', label: 'Scorecard' },
  { id: 'graph', label: 'Graph Explorer' },
  { id: 'chat', label: 'AI Analyst' },
  { id: 'compare', label: 'Compare' },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-espresso/95 backdrop-blur-md border-b border-brown-800/80 shadow-[0_4px_20px_-8px_rgba(33,26,18,0.7)]">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Crest className="w-10 h-10" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-semibold tracking-tight text-cream-100">VendorGuard</span>
              <span className="text-[10px] font-bold tracking-[0.22em] px-2 py-0.5 rounded-full border border-brass/60 text-brass-light">AI</span>
            </div>
            <p className="text-[10.5px] text-cream-300/60 tracking-wide font-body">
              Verify the Supplier. Verify the Evidence. Verify the AI.
            </p>
          </div>
        </div>

        {/* Tabs + session */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 bg-espresso-light/80 border border-brown-800 p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={activeTab === tab.id ? 'tab-active' : 'tab-idle'}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {user && (
            <div className="flex items-center gap-2.5 bg-espresso-light/80 border border-brown-800 rounded-xl pl-3 pr-1.5 py-1.5">
              <div className="text-right leading-tight">
                <div className="text-[11.5px] font-semibold text-cream-100">{user.name}</div>
                <div className="text-[10px] text-brass-light tracking-wide">{ROLE_LABELS[user.role] || user.role}</div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-1.5 rounded-lg text-cream-300/70 hover:text-cream-50 hover:bg-terracotta/30 transition-colors duration-200"
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
