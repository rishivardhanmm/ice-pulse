'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface Client {
  id: number;
  name: string;
  slug: string;
}

interface Campaign {
  id: number;
  campaignName: string | null;
  clientId: number | null;
  /** Google and Meta campaign ids are separate sequences and CAN collide numerically. */
  channel: 'google' | 'meta';
}

/** Composite key so a Google id and a Meta id that happen to be numerically equal never collide in selection state. */
function campaignKey(c: Campaign): string {
  return `${c.channel}:${c.id}`;
}

interface FilterBarProps {
  /** Show the client dropdown (internal/admin only) */
  showClientFilter: boolean;
}

export function FilterBar({ showClientFilter }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const activeClientId = sp.get('clientId') ? parseInt(sp.get('clientId')!, 10) : null;
  const activeCampaignIds = sp.get('campaignIds')
    ? sp.get('campaignIds')!.split(',').map(Number).filter(Number.isFinite)
    : [];
  const activeMetaCampaignIds = sp.get('metaCampaignIds')
    ? sp.get('metaCampaignIds')!.split(',').map(Number).filter(Number.isFinite)
    : [];
  const activeKeys = new Set([
    ...activeCampaignIds.map((id) => `google:${id}`),
    ...activeMetaCampaignIds.map((id) => `meta:${id}`),
  ]);
  const activeCampaignCount = activeCampaignIds.length + activeMetaCampaignIds.length;

  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [open, setOpen] = useState(false);

  const hasActiveFilter = activeClientId !== null || activeCampaignCount > 0;

  const loadClients = useCallback(async () => {
    if (!showClientFilter) return;
    setLoadingClients(true);
    try {
      const data = await fetch('/api/admin/clients').then((r) => r.json()) as Client[];
      setClients(Array.isArray(data) ? data.filter((c) => c.slug !== 'ice-internal') : []);
    } finally {
      setLoadingClients(false);
    }
  }, [showClientFilter]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const data = await fetch('/api/admin/campaigns').then((r) => r.json()) as Campaign[];
      setCampaigns(Array.isArray(data) ? data : []);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadClients();
      void loadCampaigns();
    }
  }, [open, loadClients, loadCampaigns]);

  function buildUrl(params: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    return `${pathname}?${next.toString()}`;
  }

  function selectClient(clientId: number | null) {
    router.push(
      buildUrl({
        clientId: clientId ? String(clientId) : undefined,
        campaignIds: undefined,
        metaCampaignIds: undefined,
      }),
    );
    setOpen(false);
  }

  function toggleCampaign(c: Campaign) {
    const isMeta = c.channel === 'meta';
    const currentIds = isMeta ? activeMetaCampaignIds : activeCampaignIds;
    const next = currentIds.includes(c.id) ? currentIds.filter((x) => x !== c.id) : [...currentIds, c.id];
    router.push(
      buildUrl(
        isMeta
          ? { metaCampaignIds: next.length ? next.join(',') : undefined, clientId: undefined }
          : { campaignIds: next.length ? next.join(',') : undefined, clientId: undefined },
      ),
    );
  }

  function clearAll() {
    router.push(buildUrl({ clientId: undefined, campaignIds: undefined, metaCampaignIds: undefined }));
    setOpen(false);
  }

  const activeClientName = clients.find((c) => c.id === activeClientId)?.name;
  const visibleCampaigns = activeClientId
    ? campaigns.filter((c) => c.clientId === activeClientId)
    : campaigns;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            borderColor: hasActiveFilter ? 'var(--gold)' : 'var(--card-border)',
            background: hasActiveFilter ? 'rgba(255,213,0,0.08)' : 'var(--card-bg)',
            color: hasActiveFilter ? 'var(--gold)' : 'var(--text-secondary)',
          }}
        >
          <i className="bi bi-funnel text-[11px]" />
          Filter
          {hasActiveFilter && (
            <span
              className="rounded-full px-1.5 text-[9px] font-bold"
              style={{ background: 'var(--gold)', color: '#14082a' }}
            >
              {activeCampaignCount || 1}
            </span>
          )}
        </button>

        {/* Active filter chips */}
        {activeClientName && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'rgba(255,213,0,0.12)', color: 'var(--gold)' }}
          >
            <i className="bi bi-person-circle text-[10px]" />
            {activeClientName}
            <button onClick={clearAll} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
          </span>
        )}
        {activeCampaignCount > 0 && (
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'rgba(255,213,0,0.12)', color: 'var(--gold)' }}
          >
            <i className="bi bi-megaphone text-[10px]" />
            {activeCampaignCount} campaign{activeCampaignCount !== 1 ? 's' : ''}
            <button onClick={clearAll} className="ml-0.5 opacity-70 hover:opacity-100">×</button>
          </span>
        )}

        {hasActiveFilter && (
          <button onClick={clearAll} className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-40 mt-2 w-80 rounded-2xl border p-4 shadow-xl"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            {/* Client section */}
            {showClientFilter && (
              <div className="mb-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  View by client
                </p>
                {loadingClients ? (
                  <div className="h-8 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
                ) : (
                  <div className="space-y-1">
                    <button
                      onClick={() => selectClient(null)}
                      className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${!activeClientId ? 'ice-nav-item-active' : 'ice-nav-item'}`}
                    >
                      All clients
                    </button>
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c.id)}
                        className={`w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${activeClientId === c.id ? 'ice-nav-item-active' : 'ice-nav-item'}`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Campaign section */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Filter by campaign
              </p>
              {loadingCampaigns ? (
                <div className="h-8 animate-pulse rounded-lg" style={{ background: 'var(--surface-2)' }} />
              ) : visibleCampaigns.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No campaigns available.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {visibleCampaigns.map((c) => {
                    const key = campaignKey(c);
                    const checked = activeKeys.has(key);
                    return (
                      <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ice-nav-item">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCampaign(c)}
                          className="rounded"
                          style={{ accentColor: 'var(--gold)' }}
                        />
                        <i
                          className={`bi ${c.channel === 'meta' ? 'bi-meta' : 'bi-google'} shrink-0`}
                          style={{ color: c.channel === 'meta' ? '#1877F2' : '#4285F4' }}
                          title={c.channel === 'meta' ? 'Meta Ads' : 'Google Ads'}
                        />
                        <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                          {c.campaignName ?? `Campaign #${c.id}`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {(activeCampaignCount > 0 || activeClientId) && (
              <button
                onClick={clearAll}
                className="mt-3 w-full rounded-xl border py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}
              >
                Clear filters
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
