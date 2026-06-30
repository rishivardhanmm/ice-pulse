'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  canvaStatusUrl,
  canvaTemplatesUrl,
  disconnectCanva,
  generateCanvaReportPlaceholder,
  refreshCanvaCapabilities,
  syncCanvaTemplates,
  type CanvaGenerationResult,
} from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { defaultRange } from '@/lib/date';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { CanvaStatusDTO, CanvaTemplateDTO } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';

const CAP_LABELS: Record<string, string> = {
  brand_template: 'Brand templates',
  autofill: 'Autofill (report generation)',
  asset_upload: 'Asset upload',
  export: 'Design export',
};
const CAP_ORDER = ['brand_template', 'autofill', 'asset_upload', 'export'];

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB');
}

export function CanvaSettingsView() {
  const sp = useSearchParams();
  const justConnected = sp.get('connected') === '1';
  const oauthError = sp.get('error');

  const { data: status, loading, refetch } = useFetch<CanvaStatusDTO>(canvaStatusUrl());
  const { data: tplData, refetch: refetchTemplates } = useFetch<{ templates: CanvaTemplateDTO[] }>(
    canvaTemplatesUrl(),
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const def = defaultRange(30);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [templateId, setTemplateId] = useState('');
  const [genResult, setGenResult] = useState<CanvaGenerationResult | null>(null);

  const templates = useMemo(() => tplData?.templates ?? [], [tplData]);
  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => (t.title ?? '').toLowerCase().includes(q) || t.canvaTemplateId.toLowerCase().includes(q));
  }, [templates, search]);

  const capAvailable = (name: string) =>
    status?.capabilities.find((c) => c.name === name)?.available ?? false;

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      setNotice(okMsg);
      refetch();
      refetchTemplates();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const onGenerate = async () => {
    setBusy('generate');
    setNotice(null);
    try {
      const res = await generateCanvaReportPlaceholder({ from, to, templateId: templateId || undefined });
      setGenResult(res);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not build the report payload.');
    } finally {
      setBusy(null);
    }
  };

  const connected = status?.connected ?? false;
  const conn = status?.connection ?? null;

  return (
    <>
      <PageHeader title="Canva Integration" subtitle="Connect ICE's Canva account to power future client reports and branded assets.">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: connected ? 'var(--green-bg, #e7f7ef)' : 'var(--surface)',
            color: connected ? 'var(--green, #1a8f5a)' : 'var(--text-muted)',
            border: '1px solid var(--card-border)',
          }}
        >
          {connected ? 'Connected' : status?.configured ? 'Not connected' : 'Not configured'}
        </span>
      </PageHeader>

      {(justConnected || oauthError || notice) && (
        <div
          className="mb-4 rounded-lg px-3 py-2 text-sm"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--card-border)',
            color: oauthError ? 'var(--red)' : 'var(--text-primary)',
          }}
        >
          {oauthError
            ? `Canva connection error: ${oauthError.replace(/_/g, ' ')}.`
            : justConnected
              ? 'Canva connected successfully. 🎉'
              : notice}
        </div>
      )}

      {loading && <Card>Loading Canva status…</Card>}

      {!loading && status && (
        <div className="space-y-6">
          {/* ── Connection ─────────────────────────────────────────── */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="ice-section-title text-base">Connection</h2>
              <div className="flex flex-wrap gap-2">
                {connected ? (
                  <>
                    <button
                      type="button"
                      className="ice-pill-btn"
                      disabled={busy !== null}
                      onClick={() => run('caps', refreshCanvaCapabilities, 'Capabilities refreshed.')}
                    >
                      <i className="bi bi-arrow-repeat" /> Refresh capabilities
                    </button>
                    <button
                      type="button"
                      className="ice-pill-btn"
                      disabled={busy !== null}
                      onClick={() => run('disconnect', disconnectCanva, 'Canva disconnected.')}
                    >
                      <i className="bi bi-box-arrow-right" /> Disconnect
                    </button>
                  </>
                ) : (
                  <a
                    href="/api/canva/connect"
                    className="ice-pill-btn-gold"
                    aria-disabled={!status.configured}
                    style={status.configured ? undefined : { pointerEvents: 'none', opacity: 0.5 }}
                  >
                    <i className="bi bi-palette" /> Connect Canva
                  </a>
                )}
              </div>
            </div>

            {!status.configured && (
              <p className="text-sm" style={{ color: 'var(--red)' }}>
                Canva is not configured. Set <code>CANVA_CLIENT_ID</code> and{' '}
                <code>CANVA_CLIENT_SECRET</code> in <code>.env.local</code> (see{' '}
                <code>docs/canva-integration.md</code>).
              </p>
            )}

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Status" value={conn?.status ?? (status.configured ? 'not connected' : 'not configured')} />
              <Field label="Connected account" value={conn?.displayName ?? '—'} />
              <Field label="Canva user ID" value={conn?.canvaUserId ?? '—'} mono />
              <Field label="Canva team ID" value={conn?.canvaTeamId ?? '—'} mono />
              <Field label="Connected at" value={fmtDate(conn?.connectedAt ?? null)} />
              <Field label="Last refreshed" value={fmtDate(conn?.lastRefreshedAt ?? null)} />
              <Field label="Granted scopes" value={(conn?.scopes ?? []).join(', ') || '—'} />
              <Field label="Redirect URI" value={status.redirectUri} mono />
            </dl>

            {!status.hasEncryptionKey && (
              <p className="mt-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                ⚠️ <strong>CANVA_TOKEN_ENCRYPTION_KEY is not set.</strong> Tokens are obfuscated but not
                encrypted at rest — set a 32+ character key in <code>.env.local</code> before any real use.
              </p>
            )}
          </Card>

          {/* ── Capabilities ──────────────────────────────────────── */}
          <Card>
            <h2 className="ice-section-title mb-3 text-base">Capabilities</h2>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Brand templates and Autofill require Canva Enterprise; they are commonly unavailable on
              Business/Teams accounts. Unavailable features are clearly marked — the connection still
              works for everything else.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CAP_ORDER.map((name) => {
                const available = capAvailable(name);
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}
                  >
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {CAP_LABELS[name] ?? name}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: available ? 'var(--green, #1a8f5a)' : 'var(--text-muted)' }}
                    >
                      {connected ? (available ? '● Available' : '○ Unavailable') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Template browser ──────────────────────────────────── */}
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="ice-section-title text-base">
                Templates {templates.length > 0 && <span style={{ color: 'var(--text-muted)' }}>({templates.length})</span>}
              </h2>
              <button
                type="button"
                className="ice-pill-btn"
                disabled={!connected || busy !== null}
                onClick={() => run('sync', syncCanvaTemplates, 'Template sync complete.')}
              >
                <i className="bi bi-cloud-download" /> Sync templates
              </button>
            </div>

            {!connected ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Connect Canva to sync templates.</p>
            ) : templates.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No templates synced yet. Click <strong>Sync templates</strong>. If your account is not
                Enterprise, brand template access may be unavailable.
              </p>
            ) : (
              <>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  className="mb-3 w-full rounded-lg px-3 py-2 text-sm outline-none sm:max-w-xs"
                  style={{ background: 'var(--search-bg)', border: '1px solid var(--search-border)', color: 'var(--search-text)' }}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredTemplates.map((t) => (
                    <div key={t.id} className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--card-border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.thumbnailUrl ? (
                        <img src={t.thumbnailUrl} alt={t.title ?? 'Template'} className="h-28 w-full object-cover" />
                      ) : (
                        <div className="flex h-28 w-full items-center justify-center text-2xl" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
                          <i className="bi bi-palette" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }} title={t.title ?? ''}>
                          {t.title ?? 'Untitled'}
                        </p>
                        <p className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }} title={t.canvaTemplateId}>
                          {t.canvaTemplateId}
                        </p>
                        <p className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Synced {fmtDate(t.lastSyncedAt)}
                        </p>
                        <button type="button" className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--gold)' }} disabled>
                          Map to client/campaign (soon)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* ── Report generation (placeholder) ───────────────────── */}
          <Card>
            <h2 className="ice-section-title mb-1 text-base">Generate Canva report (preview)</h2>
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Builds the data payload from your live Pulse data. Actual generation into a Canva design
              is enabled only when the connected account has the Autofill capability.
            </p>

            {connected && !capAvailable('autofill') && (
              <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                Canva Autofill is not available for this connected account. We can still keep the Canva
                connection and use supported features such as template sync, asset upload, or exports if
                available. Full template autofill may require Canva Enterprise or Canva-approved access.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Labeled label="Client">
                <select disabled className="canva-input" style={inputStyle}>
                  <option>All clients (soon)</option>
                </select>
              </Labeled>
              <Labeled label="Campaign">
                <select disabled className="canva-input" style={inputStyle}>
                  <option>All campaigns (soon)</option>
                </select>
              </Labeled>
              <Labeled label="From">
                <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} style={inputStyle} />
              </Labeled>
              <Labeled label="To">
                <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} style={inputStyle} />
              </Labeled>
              <Labeled label="Canva template">
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inputStyle}>
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.canvaTemplateId}>
                      {t.title ?? t.canvaTemplateId}
                    </option>
                  ))}
                </select>
              </Labeled>
            </div>

            <button type="button" className="ice-pill-btn-gold mt-3" disabled={busy === 'generate'} onClick={onGenerate}>
              <i className="bi bi-magic" /> {busy === 'generate' ? 'Building…' : 'Generate Canva report'}
            </button>

            {genResult && (
              <div className="mt-4 rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--card-border)' }}>
                <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--section-heading)' }}>
                  Report payload (from live data)
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Client" value={genResult.payload.clientName ?? '—'} />
                  <Stat label="Spend" value={formatCurrency(genResult.payload.spend, 'GBP')} />
                  <Stat label="Clicks" value={formatNumber(genResult.payload.clicks)} />
                  <Stat label="Conversions" value={formatNumber(genResult.payload.conversions)} />
                  <Stat label="CTR" value={`${genResult.payload.ctr}%`} />
                  <Stat label="Top campaign" value={genResult.payload.topCampaign ?? '—'} />
                </div>
                <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>{genResult.generation.message}</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--search-bg)',
  border: '1px solid var(--search-border)',
  color: 'var(--search-text)',
  colorScheme: 'light',
};

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
      <dd className={`text-sm ${mono ? 'font-mono text-xs' : ''}`} style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
        {value}
      </dd>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2.5 py-1.5" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="truncate text-xs font-semibold" style={{ color: 'var(--section-heading)' }} title={value}>{value}</div>
    </div>
  );
}
