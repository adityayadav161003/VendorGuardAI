import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1">
        <Dashboard activeTab={activeTab} />
      </div>

      {/* Footer */}
      <footer className="border-t border-[#233252] bg-[#0d1424] py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VendorGuard AI — Major Project 2026–2027 • GLA University</span>
          <span>Lead Developer: <strong className="text-slate-300">Aditya Yadav</strong></span>
          <span className="font-mono text-[11px] text-blue-400">repo: adityayadav161003/VendorGuardAI</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
