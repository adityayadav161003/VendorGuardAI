import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Loader2 } from 'lucide-react';

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

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
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1">
        <Dashboard activeTab={activeTab} />
      </div>

      {/* Footer */}
      <footer className="border-t border-cream-300 bg-cream-200/60 py-5 text-center text-xs text-brown-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VendorGuard AI — Major Project 2026–2027 · GLA University</span>
          <span>Lead Developer: <strong className="text-espresso">Aditya Yadav</strong></span>
          <span className="font-mono text-[11px] text-olive-700">repo: adityayadav161003/VendorGuardAI</span>
        </div>
      </footer>
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
