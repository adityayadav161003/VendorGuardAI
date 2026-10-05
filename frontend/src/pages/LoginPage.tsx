import React, { useState } from 'react';
import { ShieldCheck, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password, organization.trim() || undefined);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">VendorGuard</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">AI</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">Verify the Supplier. Verify the Evidence. Verify the AI.</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#131b2e] border border-[#233252] rounded-2xl p-6 shadow-xl">
          <div className="flex bg-[#0d1424] border border-[#233252] rounded-lg p-1 mb-5">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full bg-[#0d1424] border border-[#233252] text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={organization}
                  onChange={e => setOrganization(e.target.value)}
                  placeholder="Organization (optional)"
                  autoComplete="organization"
                  className="w-full bg-[#0d1424] border border-[#233252] text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </>
            )}
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="Work email"
              autoComplete="email"
              required
              className="w-full bg-[#0d1424] border border-[#233252] text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
            />
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              className="w-full bg-[#0d1424] border border-[#233252] text-sm text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
            />

            {error && (
              <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign In to Dashboard' : 'Create Account & Sign In'}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-[11px] text-slate-500 mt-4 text-center leading-relaxed">
              New accounts start with <span className="text-slate-300 font-semibold">procurement</span> access.
              Reviewer and admin roles are granted by an administrator.
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          VendorGuard AI — Major Project 2026–2027 • GLA University
        </p>
      </div>
    </div>
  );
};
