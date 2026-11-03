import React, { useState } from 'react';
import { LogIn, UserPlus, AlertCircle, Loader2, ShieldCheck, FileSearch, Network } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Crest, OliveBranch } from '../components/Brand';

export const LoginPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
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
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4 py-10 selection:bg-olive-600 selection:text-cream-50">
      <div className="w-full max-w-4xl grid lg:grid-cols-[1.05fr_1fr] rounded-3xl overflow-hidden shadow-lifted border border-white/60 animate-rise backdrop-blur-2xl">

        {/* ── Brand story panel ─────────────────────────────── */}
        <div className="relative bg-espresso text-cream-100 p-10 flex flex-col justify-between overflow-hidden">
          {/* Artwork */}
          <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-[380px] opacity-90 pointer-events-none">
            <OliveBranch className="w-full h-auto" />
          </div>
          {/* Vignette */}
          <div className="absolute inset-0 bg-gradient-to-br from-espresso via-espresso/70 to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center gap-3">
            <Crest className="w-12 h-12" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-semibold tracking-tight text-cream-100">VendorGuard</span>
                <span className="text-[10px] font-bold tracking-[0.22em] px-2 py-0.5 rounded-full border border-brass/60 text-brass-light">AI</span>
              </div>
              <p className="text-[11px] text-cream-300/70 tracking-wide">Supplier Due Diligence, Refined.</p>
            </div>
          </div>

          <div className="relative z-10 my-10">
            <p className="font-display text-[2rem] leading-[1.2] font-medium text-cream-100">
              Verify the Supplier.<br />
              Verify the Evidence.<br />
              <span className="text-brass-light italic">Verify the AI.</span>
            </p>
            <div className="mt-8 space-y-3.5">
              {[
                { icon: FileSearch, label: 'Document intelligence with page-level provenance' },
                { icon: ShieldCheck, label: 'Claim-level verification — no unsupported answers' },
                { icon: Network, label: 'Relationship graph intelligence & fraud signals' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-[13px] text-cream-200/85 animate-rise"
                  style={{ animationDelay: `${0.25 + i * 0.12}s` }}
                >
                  <span className="w-7 h-7 rounded-lg bg-espresso-soft/80 border border-brass/30 flex items-center justify-center shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-brass-light" />
                  </span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-[11px] text-cream-300/50 tracking-wide">
            VendorGuard AI — Major Project 2026–2027 · GLA University
          </p>
        </div>

        {/* ── Form panel ────────────────────────────────────── */}
        <div className="bg-linen/85 backdrop-blur-xl p-10 flex flex-col justify-center">
          {/* Mode switch */}
          <div className="flex bg-cream-200 border border-cream-300 rounded-xl p-1 mb-8">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                  mode === m
                    ? 'bg-gradient-to-b from-olive-500 to-olive-700 text-cream-50 shadow-[0_4px_12px_-4px_rgba(60,69,37,0.6)]'
                    : 'text-brown-600 hover:text-espresso'
                }`}
              >
                {m === 'login' ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {onBack && (
            <button onClick={onBack} className="text-[11px] text-brown-600 hover:text-espresso transition-colors mb-4 -mt-2">
              ← Back to overview
            </button>
          )}
          <h1 className="font-display text-2xl font-semibold text-espresso mb-1">
            {mode === 'login' ? 'Welcome back' : 'Request access'}
          </h1>
          <p className="text-[13px] text-brown-600 mb-7">
            {mode === 'login'
              ? 'Sign in to your supplier due-diligence workspace.'
              : 'New accounts begin with procurement-level access.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="animate-fade">
                  <label htmlFor="auth-name" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 mb-1.5">Full name</label>
                  <input id="auth-name" value={name} onChange={e => setName(e.target.value)} placeholder="Aarav Sharma"
                    autoComplete="name" className="input-premium" />
                </div>
                <div className="animate-fade">
                  <label htmlFor="auth-org" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 mb-1.5">Organization</label>
                  <input id="auth-org" value={organization} onChange={e => setOrganization(e.target.value)} placeholder="Optional"
                    autoComplete="organization" className="input-premium" />
                </div>
              </>
            )}
            <div>
              <label htmlFor="auth-email" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 mb-1.5">Work email</label>
              <input id="auth-email" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@company.com"
                autoComplete="email" required className="input-premium" />
            </div>
            <div>
              <label htmlFor="auth-password" className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brown-600 mb-1.5">Password</label>
              <input id="auth-password" value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8}
                className="input-premium" />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-xs text-terracotta-deep bg-[#F4DED4] border border-terracotta/40 rounded-xl p-3 animate-scale-in">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 rounded-xl">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {mode === 'login' ? 'Sign In to Workspace' : 'Create Account & Continue'}
            </button>
          </form>

          <p className="text-[11px] text-stonewarm mt-7 leading-relaxed">
            Protected workspace · Sessions expire automatically ·
            Reviewer and admin roles are granted by an administrator.
          </p>
        </div>
      </div>
    </div>
  );
};
