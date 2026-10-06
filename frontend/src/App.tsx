import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { SupplierPortalPage } from './pages/SupplierPortalPage';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Loader2 } from 'lucide-react';

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    // Check for tokenized supplier portal URL
    const pathname = window.location.pathname;
    if (pathname.startsWith('/portal/')) {
      const tok = pathname.slice('/portal/'.length).trim();
      if (tok) setPortalToken(tok);
    } else {
      const params = new URLSearchParams(window.location.search);
      const tok = params.get('portal_token') || params.get('token');
      if (tok && window.location.pathname.includes('portal')) {
        setPortalToken(tok);
      }
    }
  }, []);

  // Public-facing supplier portal access (no buyer login required)
  if (portalToken) {
    return (
      <SupplierPortalPage
        token={portalToken}
        onExit={() => {
          setPortalToken(null);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-brown-600 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-olive-600" />
          Restoring session…
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col selection:bg-olive-600 selection:text-cream-50">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      <div className="flex-1">
        <Dashboard activeTab={activeTab} />
      </div>

      {/* Footer */}
      <footer className="border-t border-cream-300 bg-cream-200/60 py-5 text-center text-xs text-brown-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VendorGuard AI — Decision-Support Document Verification & Risk Intelligence</span>
          <span>Lead Developer: <strong className="text-espresso">Aditya Yadav</strong> · GLA University</span>
          <span className="font-mono text-[11px] text-olive-700">repo: adityayadav161003/VendorGuardAI</span>
        </div>
      </footer>

      {/* Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
