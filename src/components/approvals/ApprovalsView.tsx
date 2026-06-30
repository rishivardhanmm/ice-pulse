'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { approvalsUrl, submitApproval } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { formatRelativeTime } from '@/lib/format';
import type { ApprovalStatus, ApprovalSubmissionDTO } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApprovalStatusPill } from '@/components/ui/StatusPill';

interface ClientOption { id: number; name: string; slug: string }
interface CampaignOption { id: number; campaignName: string | null; clientId: number | null }

type Tab = 'pending' | 'mine' | 'all';

export function ApprovalsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const tabParam = sp.get('tab');
  const tab: Tab = tabParam === 'mine' || tabParam === 'all' ? tabParam : 'pending';

  const filters =
    tab === 'pending' ? { status: 'pending' as ApprovalStatus } : tab === 'mine' ? { mine: true } : {};
  const { data, loading, error, refetch } = useFetch<{ submissions: ApprovalSubmissionDTO[] }>(
    approvalsUrl(filters),
  );

  const [showForm, setShowForm] = useState(false);

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(sp.toString());
    params.set('tab', next);
    router.push(`/approvals?${params.toString()}`);
  };

  return (
    <>
      <PageHeader
        title="Content Approvals"
        subtitle="Propose images for client posts and get sign-off before they go live."
      >
        <button onClick={() => setShowForm(true)} className="ice-pill-btn-gold">
          <i className="bi bi-plus-lg" aria-hidden="true" /> New Submission
        </button>
      </PageHeader>

      <div className="mb-4 flex gap-1 rounded-xl p-1" style={{ background: 'var(--surface-2)', maxWidth: 360 }}>
        {(['pending', 'mine', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors"
            style={{
              background: tab === t ? 'var(--card-bg)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {t === 'pending' ? 'Pending' : t === 'mine' ? 'My Submissions' : 'All'}
          </button>
        ))}
      </div>

      {error && (
        <Card>
          <ErrorState message={error} onRetry={refetch} />
        </Card>
      )}

      {!error && loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!error && !loading && data && data.submissions.length === 0 && (
        <Card>
          <EmptyState
            icon="bi-images"
            title={tab === 'pending' ? 'Nothing pending' : 'No submissions yet'}
            description={
              tab === 'pending'
                ? 'New content submissions awaiting approval will show up here.'
                : 'Propose your first image for a client to get started.'
            }
          />
        </Card>
      )}

      {!error && !loading && data && data.submissions.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} />
          ))}
        </div>
      )}

      {showForm && (
        <NewSubmissionModal
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

function SubmissionCard({ submission }: { submission: ApprovalSubmissionDTO }) {
  return (
    <a href={`/approvals/${submission.id}`} className="block">
      <Card padded={false} interactive className="overflow-hidden">
        <div
          className="aspect-square w-full bg-cover bg-center"
          style={{
            background: submission.imagePath
              ? `center / cover no-repeat url(${submission.imagePath})`
              : 'var(--surface-2)',
          }}
        />
        <div className="p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <ApprovalStatusPill status={submission.status} />
          </div>
          <p className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {submission.title || 'Untitled'}
          </p>
          <p className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {submission.clientName ?? 'No client'}
          </p>
          <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {submission.submittedByName} · {formatRelativeTime(submission.createdAt)}
          </p>
        </div>
      </Card>
    </a>
  );
}

function NewSubmissionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [clientId, setClientId] = useState<number | ''>('');
  const [campaignId, setCampaignId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/clients').then((r) => r.json()),
      fetch('/api/admin/campaigns').then((r) => r.json()),
    ]).then(([c, ca]) => {
      setClients(Array.isArray(c) ? c : []);
      setCampaigns(Array.isArray(ca) ? ca : []);
    }).catch(() => undefined);
  }, []);

  const filteredCampaigns = clientId
    ? campaigns.filter((c) => c.clientId === clientId)
    : campaigns;

  async function submit() {
    if (!file) { setError('Please choose an image.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await submitApproval({
        clientId: clientId || null,
        campaignId: campaignId || null,
        title,
        caption,
        image: file,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,8,42,0.5)' }}
    >
      <div
        className="ice-scroll max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border p-6"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: '0 24px 60px rgba(20,8,42,0.18)' }}
      >
        <h3 className="mb-4 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          New content submission
        </h3>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Client
            </label>
            <select
              className="ice-search w-full text-sm"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : ''); setCampaignId(''); }}
            >
              <option value="">No specific client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Campaign (optional)
            </label>
            <select
              className="ice-search w-full text-sm"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">None</option>
              {filteredCampaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.campaignName ?? `Campaign #${c.id}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Title
            </label>
            <input
              className="ice-search w-full text-sm"
              placeholder="e.g. Spring sale carousel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Caption / notes
            </label>
            <textarea
              className="ice-search w-full text-sm"
              rows={3}
              placeholder="Caption text or notes for the reviewer"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              Image
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs"
            />
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={submitting || !file}
              className="ice-pill-btn-gold flex-1 justify-center py-2.5 text-sm disabled:opacity-60"
            >
              {submitting ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Submit for approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
