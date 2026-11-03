import React from 'react';
import { motion } from 'framer-motion';
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
  onOpenShortcuts?: () => void;
}

const TABS = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'conflicts_docs', label: 'Documents & Pipeline' },
  { id: 'graph', label: 'Network Graph' },
  { id: 'chat', label: 'AI Analyst' },
  { id: 'compare', label: 'Tender Compare' },
  { id: 'monitoring', label: 'Watchlist & Feed' },
  { id: 'portfolio', label: 'Portfolio Intel' },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenShortcuts }) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col xl:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Crest className="w-10 h-10 drop-shadow-[0_2px_6px_rgba(185,151,91,0.35)]" />
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
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <nav className="flex items-center gap-1 glass-chip p-1 rounded-xl overflow-x-auto max-w-full">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? 'text-cream-50 font-semibold'
                      : 'text-cream-300/70 hover:text-cream-100 hover:bg-white/[0.06]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-gradient-to-b from-olive-500/90 to-olive-700/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_12px_-4px_rgba(60,69,37,0.7)]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {onOpenShortcuts && (
              <button
                onClick={onOpenShortcuts}
                title="Keyboard Shortcuts (?)"
                className="glass-chip px-2.5 py-1.5 text-cream-300/70 hover:text-cream-100 text-xs font-mono transition-colors cursor-pointer"
              >
                ?
              </button>
            )}

            {user && (
              <div className="glass-chip flex items-center gap-2.5 pl-3 pr-1.5 py-1.5">
                <div className="text-right leading-tight">
                  <div className="text-[11.5px] font-semibold text-cream-100">{user.name}</div>
                  <div className="text-[10px] text-brass-light tracking-wide">{ROLE_LABELS[user.role] || user.role}</div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 rounded-lg text-cream-300/70 hover:text-cream-50 hover:bg-terracotta/30 transition-colors duration-200 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
