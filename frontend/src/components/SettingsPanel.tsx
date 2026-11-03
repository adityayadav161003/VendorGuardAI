import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, KeyRound, Scale, Check, Loader2, Copy, Trash2, ShieldCheck } from 'lucide-react';
import { WorkspaceMember, ApiKeyRecord, PolicyRecord } from '../types';
import { api } from '../services/api';

const ROLES = ['procurement_officer', 'reviewer', 'admin'] as const;

const ROLE_LABELS: Record<string, string> = {
  procurement_officer: 'Procurement',
  reviewer: 'Reviewer',
  admin: 'Administrator',
};

/** Admin-only settings: members & roles, API keys, approval policies. */
export const SettingsPanel: React.FC = () => {
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [memberMsg, setMemberMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [keyName, setKeyName] = useState('');
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  const [policies, setPolicies] = useState<PolicyRecord[] | null>(null);

  const loadAll = () => {
    api.getMembers().then(setMembers).catch(() => setMembers([]));
    api.listApiKeys().then(setKeys).catch(() => setKeys([]));
    api.getPolicies().then(setPolicies).catch(() => setPolicies([]));
  };

  useEffect(loadAll, []);

  const saveRole = async (userId: string) => {
    setSavingId(userId);
    setMemberMsg(null);
    try {
      const updated = await api.updateMemberRole(userId, roles[userId]);
      setMembers(prev => (prev || []).map(m => (m.user_id === userId ? { ...m, role: updated.role as WorkspaceMember['role'] } : m)));
      setMemberMsg({ id: userId, ok: true, text: `Role updated to ${ROLE_LABELS[updated.role] || updated.role}.` });
    } catch (err: any) {
      setMemberMsg({ id: userId, ok: false, text: err.message || 'Failed to update role' });
      loadAll();
    } finally {
      setSavingId(null);
    }
  };

  const createKey = async () => {
    if (!keyName.trim()) return;
    setKeyBusy(true);
    try {
      const created = await api.createApiKey(keyName.trim());
      setRawToken(created.raw_token);
      setKeyName('');
      api.listApiKeys().then(setKeys).catch(() => {});
    } catch (err: any) {
      alert(err.message);
    } finally {
      setKeyBusy(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    try {
      await api.revokeApiKey(keyId);
      api.listApiKeys().then(setKeys).catch(() => {});
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade">
      {/* ── Members ─────────────────────────────────────── */}
      <div className="card-premium card-hover p-6 animate-rise">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-9 h-9 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Users className="w-4 h-4 text-brass-light" />
          </span>
          <h3 className="font-display text-lg font-semibold text-espresso">Workspace Members</h3>
        </div>
        <p className="text-[11px] text-stonewarm mb-5">
          Roles drive what each member can do: Procurement uploads and runs analysis; Reviewer
          records claim decisions and supplier status; Administrator manages everything, including roles.
        </p>

        {members === null ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.user_id} className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto_auto] gap-2 items-center p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-espresso truncate">{m.name}</div>
                  <div className="text-[10px] text-stonewarm font-mono truncate">{m.email}</div>
                </div>
                <select
                  value={roles[m.user_id] ?? m.role}
                  onChange={e => setRoles(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                  className="input-premium !py-1.5 !px-2.5 !text-xs cursor-pointer"
                >
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <button
                  onClick={() => saveRole(m.user_id)}
                  disabled={savingId === m.user_id || (roles[m.user_id] ?? m.role) === m.role}
                  className="btn-primary !py-1.5 !px-3 !text-[11px]"
                >
                  {savingId === m.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
                {memberMsg?.id === m.user_id && (
                  <span className={`text-[10px] font-semibold sm:col-span-4 ${memberMsg.ok ? 'text-sage-deep' : 'text-terracotta-deep'}`}>
                    {memberMsg.text}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── API keys ────────────────────────────────────── */}
      <div className="card-premium card-hover p-6 animate-rise" style={{ animationDelay: '0.08s' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-9 h-9 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <KeyRound className="w-4 h-4 text-brass-light" />
          </span>
          <h3 className="font-display text-lg font-semibold text-espresso">API Keys</h3>
        </div>
        <p className="text-[11px] text-stonewarm mb-5">
          For ERP / procurement-system integrations. Send as <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
          The full token is shown once at creation — store it securely.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <input
            className="input-premium flex-1"
            placeholder="Key name (e.g. ERP integration)"
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
          />
          <button onClick={createKey} disabled={keyBusy || !keyName.trim()} className="btn-primary">
            {keyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Create
          </button>
        </div>

        {rawToken && (
          <div className="mb-4 p-3.5 rounded-xl bg-olive-50 border border-olive-300 text-xs animate-scale-in">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-olive-800">New key (copy now — shown once)</span>
              <button
                onClick={() => navigator.clipboard?.writeText(rawToken)}
                className="inline-flex items-center gap-1 text-olive-700 hover:text-olive-800 font-semibold"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <code className="font-mono text-[11px] text-espresso break-all">{rawToken}</code>
          </div>
        )}

        {keys !== null && keys.length > 0 && (
          <ul className="space-y-2">
            {keys.map(k => (
              <li key={k.key_id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 text-xs">
                <div>
                  <span className="font-semibold text-espresso">{k.name || k.key_id.slice(0, 12)}</span>
                  <span className="font-mono text-stonewarm ml-2">{k.key_id.slice(0, 14)}…</span>
                </div>
                <button onClick={() => revokeKey(k.key_id)} className="btn-danger !py-1 !px-2.5 !text-[10px]">
                  <Trash2 className="w-3 h-3" /> Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        {keys !== null && keys.length === 0 && (
          <p className="text-xs text-stonewarm">No API keys yet.</p>
        )}
      </div>

      {/* ── Policies ────────────────────────────────────── */}
      <div className="card-premium card-hover p-6 animate-rise" style={{ animationDelay: '0.16s' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-9 h-9 rounded-lg bg-espresso flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Scale className="w-4 h-4 text-brass-light" />
          </span>
          <h3 className="font-display text-lg font-semibold text-espresso">Approval Policies</h3>
        </div>
        <p className="text-[11px] text-stonewarm mb-5">
          Governance rules applied to supplier decisions (e.g. dual sign-off on high risk).
        </p>
        {policies === null ? (
          <div className="space-y-2">{[1, 2].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
        ) : policies.length === 0 ? (
          <p className="text-xs text-stonewarm">No custom policies configured — defaults apply (HIGH risk requires dual reviewer sign-off).</p>
        ) : (
          <ul className="space-y-2">
            {policies.map((p, i) => (
              <li key={i} className="flex items-center gap-2.5 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-olive-700 shrink-0" />
                <span className="font-semibold text-espresso">{p.name || p.key || JSON.stringify(p).slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
