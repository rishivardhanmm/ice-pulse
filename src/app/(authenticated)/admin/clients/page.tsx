'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { ClientBudgetEditor } from '@/components/dashboard/ClientBudgetGauge';

interface Client {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
}

interface Campaign {
  id: number;
  campaignName: string | null;
  campaignStatus: string | null;
  clientId: number | null;
  clientName: string | null;
  clientSlug: string | null;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  clientId: number | null;
  clientName: string | null;
  isActive: boolean;
}

export const dynamic = 'force-dynamic';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'users' | 'budget'>('campaigns');
  const [clientBudget, setClientBudget] = useState<{ pctUsed: number; updatedAt: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Create client form
  const [newClientName, setNewClientName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create user form
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'client' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState('');
  const [copiedCreds, setCopiedCreds] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [c, ca, u] = await Promise.all([
        fetch('/api/admin/clients').then((r) => r.json()),
        fetch('/api/admin/campaigns').then((r) => r.json()),
        fetch('/api/admin/users').then((r) => r.json()),
      ]);
      // jsonOk returns data directly (no .data wrapper)
      // Filter out ICE Creates (Internal) — it's not an external client
      setClients(
        (Array.isArray(c) ? c : []).filter((cl: Client) => cl.slug !== 'ice-internal'),
      );
      setCampaigns(Array.isArray(ca) ? ca : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch {
      setLoadError('Failed to load data. Make sure you are signed in as an admin or internal user.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadBudget = useCallback(async (clientId: number) => {
    setClientBudget(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/budget`);
      const data = (await res.json().catch(() => null)) as { pctUsed: number; updatedAt: string | null } | null;
      setClientBudget(data);
    } catch {
      // Budget is optional; if it fails just show no budget
    }
  }, []);

  useEffect(() => {
    if (selectedClient) void loadBudget(selectedClient.id);
  }, [selectedClient, loadBudget]);

  async function createClient() {
    const name = newClientName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then((r) => r.json());
      if (res.error) { setCreateError(res.error); return; }
      setNewClientName('');
      await load();
      // Auto-select the newly created client
      if (res.id) {
        setSelectedClient({ id: res.id, name: res.name, slug: res.slug, description: null, status: 'active' });
      }
    } catch {
      setCreateError('Failed to create client. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function assignCampaign(campaignId: number, clientId: number | null) {
    await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, clientId }),
    });
    await load();
  }

  async function createUser() {
    setUserError('');
    const email = newUser.email.trim();
    const name = newUser.name.trim();
    const password = newUser.password;
    if (!email || !name || !password) {
      setUserError('All fields are required.'); return;
    }
    if (!selectedClient) {
      setUserError('Select a client first.'); return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, role: 'client', clientId: selectedClient.id }),
      }).then((r) => r.json());
      if (res.error) { setUserError(res.error); return; }
      // Copy credentials to clipboard
      const url = `${window.location.origin}/login`;
      const creds = `ICE Pulse login details\nURL: ${url}\nEmail: ${email}\nPassword: ${password}`;
      await navigator.clipboard.writeText(creds).catch(() => null);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 4000);
      setNewUser({ email: '', name: '', password: '', role: 'client' });
      await load();
    } catch {
      setUserError('Failed to create user. Please try again.');
    } finally {
      setCreatingUser(false);
    }
  }

  async function deleteClient(client: Client) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, { method: 'DELETE' }).then((r) => r.json());
      if (res.error) { alert(res.error); return; }
      setConfirmDelete(null);
      setSelectedClient(null);
      await load();
    } catch {
      alert('Failed to delete client. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function toggleUser(userId: number, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, isActive }),
    });
    await load();
  }

  const clientUrl = (slug: string) =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/clients/${slug}`
      : `/clients/${slug}`;

  const clientCampaigns = campaigns.filter((c) => c.clientId === selectedClient?.id);
  const unassignedCampaigns = campaigns.filter((c) => c.clientId === null);
  const otherClientCampaigns = campaigns.filter(
    (c) => c.clientId !== null && c.clientId !== selectedClient?.id,
  );
  const clientUsers = users.filter((u) => u.clientId === selectedClient?.id);

  return (
    <>
      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,8,42,0.5)' }}>
          <div
            className="w-full max-w-sm rounded-2xl border p-6"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: '0 24px 60px rgba(20,8,42,0.18)' }}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--red-subtle)' }}>
              <i className="bi bi-trash3" style={{ color: 'var(--red)', fontSize: 20 }} />
            </div>
            <h3 className="mb-1 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Delete {confirmDelete.name}?
            </h3>
            <p className="mb-5 text-xs" style={{ color: 'var(--text-muted)' }}>
              This will permanently delete the client, unassign all their campaigns, and remove their user accounts. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteClient(confirmDelete)}
                disabled={deleting}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--red)' }}
              >
                {deleting ? <><i className="bi bi-arrow-repeat animate-spin" /> Deleting…</> : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Client Management"
        subtitle="Create clients, assign campaigns, and set up login access."
      />

      {loadError && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}
        >
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* ── LEFT: client list ── */}
        <div className="space-y-4">
          <Card>
            <h2 className="ice-section-title mb-3 text-sm">
              Clients
              <span
                className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {clients.length}
              </span>
            </h2>

            {loading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                No external clients yet. Create your first one below.
              </p>
            ) : (
              <ul className="space-y-1">
                {clients.map((c) => {
                  const cCount = campaigns.filter((cm) => cm.clientId === c.id).length;
                  return (
                    <li key={c.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => { setSelectedClient(c); setActiveTab('campaigns'); }}
                        className={`flex-1 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          selectedClient?.id === c.id ? 'ice-nav-item-active' : 'ice-nav-item'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {c.name}
                          </span>
                          {cCount > 0 && (
                            <span
                              className="rounded-full px-1.5 text-[10px] font-semibold"
                              style={{ background: 'var(--gold)', color: '#14082a' }}
                            >
                              {cCount}
                            </span>
                          )}
                        </div>
                        <span className="block truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          /clients/{c.slug}
                        </span>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(c)}
                        className="flex-shrink-0 rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: 'var(--red)' }}
                        title="Delete client"
                      >
                        <i className="bi bi-trash3 text-xs" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* New client form */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--card-border)' }}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Add new client
              </p>
              <input
                className="ice-search mb-2 w-full text-sm"
                placeholder="e.g. HLS Coventry"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void createClient()}
              />
              {createError && (
                <p className="mb-2 text-xs" style={{ color: 'var(--red)' }}>{createError}</p>
              )}
              <button
                onClick={() => void createClient()}
                disabled={creating || !newClientName.trim()}
                className="ice-pill-btn-gold w-full justify-center py-1.5 text-xs disabled:opacity-60"
              >
                {creating
                  ? <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" />
                  : <i className="bi bi-plus-lg" aria-hidden="true" />}
                {' '}Create client
              </button>
            </div>
          </Card>
        </div>

        {/* ── RIGHT: selected client detail ── */}
        {selectedClient ? (
          <div className="space-y-4">
            {/* Client header */}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    {selectedClient.name}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code
                      className="rounded px-2 py-0.5 text-[11px]"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                    >
                      {clientUrl(selectedClient.slug)}
                    </code>
                    <button
                      onClick={() => void navigator.clipboard.writeText(clientUrl(selectedClient.slug))}
                      className="ice-icon-btn"
                      title="Copy URL"
                    >
                      <i className="bi bi-clipboard text-xs" />
                    </button>
                    <a
                      href={`/clients/${selectedClient.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ice-icon-btn"
                      title="Preview client view"
                    >
                      <i className="bi bi-box-arrow-up-right text-xs" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-pill status-live">
                    {clientCampaigns.length} campaign{clientCampaigns.length !== 1 ? 's' : ''}
                  </span>
                  <span className="status-pill status-neutral">
                    {clientUsers.length} user{clientUsers.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setConfirmDelete(selectedClient)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                    style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}
                    title="Delete this client"
                  >
                    <i className="bi bi-trash3 mr-1 text-[10px]" />
                    Delete
                  </button>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)' }}>
              {(['campaigns', 'users', 'budget'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors"
                  style={{
                    background: activeTab === tab ? 'var(--card-bg)' : 'transparent',
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {tab === 'campaigns' ? `Campaigns (${clientCampaigns.length})` : tab === 'users' ? `Users (${clientUsers.length})` : 'Budget'}
                </button>
              ))}
            </div>

            {/* Campaigns tab */}
            {activeTab === 'campaigns' && (
              <Card>
                {/* Assigned */}
                <h3 className="ice-section-title mb-2 text-xs">
                  Assigned to {selectedClient.name}
                </h3>
                {clientCampaigns.length === 0 ? (
                  <p className="mb-4 rounded-lg px-3 py-2.5 text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                    No campaigns assigned yet — add from the unassigned list below.
                  </p>
                ) : (
                  <ul className="mb-4 space-y-1">
                    {clientCampaigns.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <i className="bi bi-check-circle-fill text-xs flex-shrink-0" style={{ color: 'var(--green)' }} />
                        <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {c.campaignName ?? `Campaign #${c.id}`}
                        </span>
                        {c.campaignStatus && (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {c.campaignStatus}
                          </span>
                        )}
                        <button
                          onClick={() => void assignCampaign(c.id, null)}
                          className="ml-1 flex-shrink-0 text-xs"
                          style={{ color: 'var(--red)' }}
                          title="Remove from client"
                        >
                          <i className="bi bi-x-circle" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Unassigned */}
                {unassignedCampaigns.length > 0 && (
                  <>
                    <h3 className="ice-section-title mb-2 text-xs">Unassigned campaigns</h3>
                    <ul className="mb-4 space-y-1">
                      {unassignedCampaigns.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg px-3 py-2"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <i className="bi bi-dash-circle text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="flex-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {c.campaignName ?? `Campaign #${c.id}`}
                          </span>
                          <button
                            onClick={() => void assignCampaign(c.id, selectedClient.id)}
                            className="ml-1 flex-shrink-0 text-xs font-semibold"
                            style={{ color: 'var(--gold)' }}
                            title="Assign to this client"
                          >
                            <i className="bi bi-plus-circle" /> Assign
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Other-client campaigns */}
                {otherClientCampaigns.length > 0 && (
                  <>
                    <h3 className="ice-section-title mb-2 text-xs">Assigned to other clients</h3>
                    <ul className="space-y-1">
                      {otherClientCampaigns.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 opacity-60"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <i className="bi bi-lock text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="flex-1 truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {c.campaignName ?? `Campaign #${c.id}`}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            → {c.clientName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {unassignedCampaigns.length === 0 && clientCampaigns.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    All campaigns are assigned to other clients.
                  </p>
                )}
              </Card>
            )}

            {/* Budget tab */}
            {activeTab === 'budget' && (
              <Card>
                <h3 className="ice-section-title mb-1 text-sm">Budget utilisation</h3>
                <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Set the percentage of the client&apos;s budget that has been used. This number will be displayed on the client&apos;s dashboard.
                </p>
                <ClientBudgetEditor
                  clientId={selectedClient.id}
                  current={clientBudget}
                  onSaved={() => void loadBudget(selectedClient.id)}
                />
              </Card>
            )}

            {/* Users tab */}
            {activeTab === 'users' && (
              <Card>
                <h3 className="ice-section-title mb-3 text-sm">
                  Users for {selectedClient.name}
                </h3>

                {clientUsers.length > 0 ? (
                  <ul className="mb-5 space-y-1">
                    {clientUsers.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                        style={{ background: 'var(--surface-2)' }}
                      >
                        <div
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ background: 'var(--gold)', color: '#14082a' }}
                        >
                          {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {u.name}
                          </p>
                          <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {u.email}
                          </p>
                        </div>
                        <button
                          onClick={() => void toggleUser(u.id, !u.isActive)}
                          className={`status-pill text-[10px] ${u.isActive ? 'status-live' : 'status-neutral'}`}
                          title={u.isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    No users yet. Create login credentials below to share with the client.
                  </p>
                )}

                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--card-border)', background: 'var(--surface-2)' }}
                >
                  <h4 className="ice-section-title mb-3 text-xs">Create login for {selectedClient.name}</h4>
                  <div className="space-y-2">
                    <input
                      className="ice-search w-full text-sm"
                      placeholder="Contact full name"
                      value={newUser.name}
                      onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                    />
                    <input
                      className="ice-search w-full text-sm"
                      placeholder="Email address"
                      type="email"
                      autoComplete="off"
                      value={newUser.email}
                      onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                    />
                    <div className="relative">
                      <input
                        className="ice-search w-full pr-20 text-sm"
                        placeholder="Temporary password"
                        type="text"
                        autoComplete="new-password"
                        value={newUser.password}
                        onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                          setNewUser((u) => ({
                            ...u,
                            password: Array.from(
                              { length: 12 },
                              () => chars[Math.floor(Math.random() * chars.length)],
                            ).join(''),
                          }));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold"
                        style={{ color: 'var(--gold)' }}
                      >
                        Generate
                      </button>
                    </div>

                    {userError && (
                      <p className="text-xs" style={{ color: 'var(--red)' }}>{userError}</p>
                    )}

                    <button
                      onClick={() => void createUser()}
                      disabled={creatingUser}
                      className="ice-pill-btn-gold w-full justify-center py-2 text-xs disabled:opacity-60"
                    >
                      {creatingUser ? (
                        <><i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" /> Creating…</>
                      ) : copiedCreds ? (
                        <><i className="bi bi-check-lg" aria-hidden="true" /> Credentials copied to clipboard!</>
                      ) : (
                        <><i className="bi bi-person-plus" aria-hidden="true" /> Create &amp; copy credentials</>
                      )}
                    </button>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      The login URL, email and password will be copied to your clipboard automatically so you can paste them into an email.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <div className="flex flex-col items-center py-16 text-center">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: 'var(--surface-2)' }}
              >
                <i className="bi bi-people text-2xl" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Select a client to get started
              </p>
              <p className="mt-1 max-w-xs text-xs" style={{ color: 'var(--text-muted)' }}>
                Choose a client from the left panel, or type a name and click &ldquo;Create client&rdquo; to add your first one.
              </p>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
