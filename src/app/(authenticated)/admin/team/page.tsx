'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { teamRolesUrl } from '@/lib/api-client';
import type { TeamRoleDTO } from '@/lib/types';

interface InternalUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'internal' | 'client';
  teamRoleId: number | null;
  teamRoleName: string | null;
  isActive: boolean;
}

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [roles, setRoles] = useState<TeamRoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'internal' as 'admin' | 'internal', teamRoleId: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [copiedCreds, setCopiedCreds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [u, r] = await Promise.all([
        fetch('/api/admin/users').then((res) => res.json()),
        fetch(teamRolesUrl()).then((res) => res.json()),
      ]);
      setUsers((Array.isArray(u) ? u : []).filter((x: InternalUser) => x.role !== 'client'));
      setRoles(Array.isArray(r) ? r : []);
    } catch {
      setLoadError('Failed to load team data.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createEmployee() {
    setCreateError('');
    const email = form.email.trim();
    const name = form.name.trim();
    if (!email || !name || !form.password) { setCreateError('All fields are required.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          password: form.password,
          role: form.role,
          teamRoleId: form.teamRoleId ? Number(form.teamRoleId) : null,
        }),
      }).then((r) => r.json());
      if (res.error) { setCreateError(res.error); return; }

      const url = `${window.location.origin}/login`;
      const creds = `ICE Pulse login details\nURL: ${url}\nEmail: ${email}\nPassword: ${form.password}`;
      await navigator.clipboard.writeText(creds).catch(() => null);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 4000);

      setForm({ email: '', name: '', password: '', role: 'internal', teamRoleId: '' });
      await load();
    } catch {
      setCreateError('Failed to create employee. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(userId: number, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, isActive }),
    });
    await load();
  }

  return (
    <>
      <PageHeader title="Team Management" subtitle="Create internal employee logins and assign their team role." />

      {loadError && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Card padded={false}>
          <div className="p-5">
            <h2 className="ice-section-title mb-3 text-sm">
              Employees
              <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {users.length}
              </span>
            </h2>

            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : users.length === 0 ? (
              <EmptyState icon="bi-person-badge" title="No internal employees yet" description="Create your first employee login on the right." />
            ) : (
              <ul className="space-y-1.5">
                {users.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: 'var(--gold)', color: '#14082a' }}
                    >
                      {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                      <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {u.email} · {u.role === 'admin' ? 'Admin' : 'Internal'}
                        {u.teamRoleName ? ` · ${u.teamRoleName}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => void toggleActive(u.id, !u.isActive)}
                      className={`status-pill text-[10px] ${u.isActive ? 'status-live' : 'status-neutral'}`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="ice-section-title mb-3 text-sm">Add employee</h2>
          <div className="space-y-2">
            <input
              className="ice-search w-full text-sm"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="ice-search w-full text-sm"
              placeholder="Email address"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <div className="relative">
              <input
                className="ice-search w-full pr-20 text-sm"
                placeholder="Temporary password"
                type="text"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => {
                  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                  setForm((f) => ({
                    ...f,
                    password: Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
                  }));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold"
                style={{ color: 'var(--gold)' }}
              >
                Generate
              </button>
            </div>

            <select
              className="ice-search w-full text-sm"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'internal' }))}
            >
              <option value="internal">Internal</option>
              <option value="admin">Admin</option>
            </select>

            <select
              className="ice-search w-full text-sm"
              value={form.teamRoleId}
              onChange={(e) => setForm((f) => ({ ...f, teamRoleId: e.target.value }))}
            >
              <option value="">No team role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}{r.canApprove ? ' (can approve)' : ''}</option>
              ))}
            </select>

            {createError && <p className="text-xs" style={{ color: 'var(--red)' }}>{createError}</p>}

            <button
              onClick={() => void createEmployee()}
              disabled={creating}
              className="ice-pill-btn-gold w-full justify-center py-2 text-xs disabled:opacity-60"
            >
              {creating ? (
                <><i className="bi bi-arrow-repeat animate-spin" /> Creating…</>
              ) : copiedCreds ? (
                <><i className="bi bi-check-lg" /> Credentials copied!</>
              ) : (
                <><i className="bi bi-person-plus" /> Create &amp; copy credentials</>
              )}
            </button>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Login URL, email and password will be copied to your clipboard.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
