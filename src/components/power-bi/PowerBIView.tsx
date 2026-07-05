'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { PowerBIReportDTO } from '@/lib/types';

interface ReportsResp { reports: PowerBIReportDTO[] }
interface EmbedTokenResp { token: string; tokenId: string; expiration: string }

function groupByWorkspace(reports: PowerBIReportDTO[]): Record<string, PowerBIReportDTO[]> {
  const groups: Record<string, PowerBIReportDTO[]> = {};
  for (const r of reports) {
    if (!groups[r.workspaceName]) groups[r.workspaceName] = [];
    groups[r.workspaceName].push(r);
  }
  return groups;
}

function ReportIcon({ type }: { type: string }) {
  const icon = type === 'PaginatedReport' ? 'bi-file-earmark-ruled' : 'bi-bar-chart-fill';
  return <i className={`bi ${icon}`} aria-hidden="true" />;
}

function EmbedFrame({
  report,
  onClose,
}: {
  report: PowerBIReportDTO;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/power-bi/embed-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: report.workspaceId, reportId: report.id }),
    })
      .then(async (res) => {
        const body = (await res.json()) as EmbedTokenResp & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        return body;
      })
      .then((data) => {
        if (cancelled) return;
        // Build the embed URL with the token
        const url = new URL(report.embedUrl);
        url.searchParams.set('accessToken', data.token);
        url.searchParams.set('tokenType', 'Embed');
        url.searchParams.set('autoAuth', 'false');
        setEmbedUrl(url.toString());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        // Embed token generation can fail if service principal isn't in the workspace.
        // Fall back to the web URL opened in a new tab.
        if (msg.includes('GenerateToken') || msg.includes('403') || msg.includes('401')) {
          setError('embed_unsupported');
        } else {
          setError(msg);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [report]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
          Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {report.name}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
            {report.workspaceName}
          </p>
        </div>
        <a
          href={report.webUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
          style={{ background: 'var(--accent-primary)', color: '#fff' }}
        >
          <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
          Open in Power BI
        </a>
      </div>

      {/* Body */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div
                className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-3"
                style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Loading report…
              </p>
            </div>
          </div>
        )}

        {!loading && error === 'embed_unsupported' && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <i className="bi bi-shield-lock text-2xl" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
              </div>
              <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                Embedded view requires workspace access
              </p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                The ICE Pulse service principal must be added as a Member or Admin of the{' '}
                <strong>{report.workspaceName}</strong> workspace in Power BI for embedded reports
                to work. Click below to open the report directly in Power BI instead.
              </p>
              <a
                href={report.webUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--accent-primary)', color: '#fff' }}
              >
                <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                Open in Power BI
              </a>
            </div>
          </div>
        )}

        {!loading && error && error !== 'embed_unsupported' && (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Could not load report
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {!loading && embedUrl && (
          <iframe
            ref={containerRef as React.RefObject<HTMLIFrameElement>}
            src={embedUrl}
            title={report.name}
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
}

function ReportCard({
  report,
  onOpen,
}: {
  report: PowerBIReportDTO;
  onOpen: (r: PowerBIReportDTO) => void;
}) {
  return (
    <div
      className="group flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-subtle)',
      }}
      onClick={() => onOpen(report)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(report)}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(243,88,26,0.1)', color: '#F3581A' }}
      >
        <ReportIcon type={report.reportType} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold leading-snug mb-0.5 truncate group-hover:underline"
          style={{ color: 'var(--text-primary)' }}
        >
          {report.name}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
          {report.reportType === 'PaginatedReport' ? 'Paginated Report' : 'Power BI Report'}
        </p>
      </div>
      <i
        className="bi bi-chevron-right text-xs mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: 'var(--text-tertiary)' }}
        aria-hidden="true"
      />
    </div>
  );
}

export function PowerBIView() {
  const [reports, setReports] = useState<PowerBIReportDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<PowerBIReportDTO | null>(null);
  const [search, setSearch] = useState('');

  const loadReports = useCallback((force = false) => {
    setLoading(true);
    setError(null);
    fetch(`/api/power-bi/reports${force ? '?force=true' : ''}`)
      .then(async (res) => {
        const body = (await res.json()) as ReportsResp & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        return body;
      })
      .then((data) => { setReports(data.reports); setLoading(false); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  if (activeReport) {
    return <EmbedFrame report={activeReport} onClose={() => setActiveReport(null)} />;
  }

  const filtered = !reports
    ? []
    : search.trim()
    ? reports.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.workspaceName.toLowerCase().includes(search.toLowerCase()),
      )
    : reports;

  const grouped = groupByWorkspace(filtered);
  const workspaceNames = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Power BI Reports"
        subtitle="Browse and open your Microsoft Power BI reports."
      >
        <button
          onClick={() => loadReports(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </PageHeader>

      {/* Search bar */}
      {!loading && !error && (reports?.length ?? 0) > 0 && (
        <div className="relative max-w-sm">
          <i
            className="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--text-tertiary)' }}
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <EmptyState
            icon="bi-exclamation-triangle"
            title="Could not load reports"
            description={error}
          />
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon="bi-bar-chart"
            title={search ? 'No matching reports' : 'No reports found'}
            description={
              search
                ? 'Try a different search term.'
                : 'Make sure the ICE Pulse service principal has access to at least one Power BI workspace.'
            }
          />
        </Card>
      )}

      {!loading && !error && workspaceNames.length > 0 && (
        <div className="flex flex-col gap-8">
          {workspaceNames.map((wsName) => (
            <section key={wsName}>
              <div className="flex items-center gap-2 mb-3">
                <i
                  className="bi bi-grid-1x2 text-sm"
                  style={{ color: 'var(--accent-primary)' }}
                  aria-hidden="true"
                />
                <h2
                  className="text-sm font-semibold tracking-wide uppercase"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {wsName}
                </h2>
                <span
                  className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
                >
                  {grouped[wsName].length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[wsName].map((r) => (
                  <ReportCard key={r.id} report={r} onOpen={setActiveReport} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
