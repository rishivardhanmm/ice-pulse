'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { TeamRoleDTO } from '@/lib/types';
import { teamRolesUrl, createTeamRole, updateTeamRole } from '@/lib/api-client';

export const dynamic = 'force-dynamic';

export default function TeamRolesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [roles, setRoles] = useState<TeamRoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [canApprove, setCanApprove] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(teamRolesUrl()).then((r) => r.json());
      setRoles(Array.isArray(res) ? res : []);
    } catch {
      setError('Failed to load team roles.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createTeamRole({ name: name.trim(), canApprove });
      setName('');
      setCanApprove(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create role.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleApprove(role: TeamRoleDTO) {
    try {
      await updateTeamRole(role.id, { canApprove: !role.canApprove });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role.');
    }
  }

  return (
    <>
      <PageHeader
        title="Team Roles"
        subtitle="Define job titles for internal staff and choose which ones can approve content."
      />

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card padded={false}>
          <div className="p-5">
            <h2 className="ice-section-title mb-3 text-sm">
              Roles
              <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                {roles.length}
              </span>
            </h2>

            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <EmptyState icon="bi-shield-check" title="No team roles yet" description="Create your first role on the right." />
            ) : (
              <ul className="space-y-1.5">
                {roles.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</span>
                    {isAdmin ? (
                      <button
                        onClick={() => void toggleApprove(r)}
                        className={`status-pill text-[10px] ${r.canApprove ? 'status-live' : 'status-neutral'}`}
                        title="Click to toggle approval power"
                      >
                        {r.canApprove ? 'Can approve' : 'No approve power'}
                      </button>
                    ) : (
                      <span className={`status-pill text-[10px] ${r.canApprove ? 'status-live' : 'status-neutral'}`}>
                        {r.canApprove ? 'Can approve' : 'No approve power'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {isAdmin ? (
          <Card>
            <h2 className="ice-section-title mb-3 text-sm">Add role</h2>
            <div className="space-y-2">
              <input
                className="ice-search w-full text-sm"
                placeholder="e.g. Designer, Account Manager"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void create()}
              />
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={canApprove} onChange={(e) => setCanApprove(e.target.checked)} />
                Can approve content submissions
              </label>
              <button
                onClick={() => void create()}
                disabled={creating || !name.trim()}
                className="ice-pill-btn-gold w-full justify-center py-1.5 text-xs disabled:opacity-60"
              >
                {creating ? <i className="bi bi-arrow-repeat animate-spin" /> : <><i className="bi bi-plus-lg" /> Create role</>}
              </button>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon="bi-lock"
              title="Admin access required"
              description="Only admins can create or edit team roles."
            />
          </Card>
        )}
      </div>
    </>
  );
}
