'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  approvalDetailUrl,
  addApprovalComment,
  decideApproval,
  resubmitApproval,
} from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import { formatDateTime } from '@/lib/format';
import type { ApprovalDetailDTO, ApprovalEventDTO } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApprovalStatusPill } from '@/components/ui/StatusPill';

const EVENT_META: Record<string, { icon: string; verb: string; color: string }> = {
  submitted: { icon: 'bi-upload', verb: 'submitted this', color: 'var(--text-muted)' },
  comment: { icon: 'bi-chat-left-text', verb: 'commented', color: 'var(--text-muted)' },
  approved: { icon: 'bi-check-circle-fill', verb: 'approved this', color: 'var(--green)' },
  rejected: { icon: 'bi-x-circle-fill', verb: 'rejected this', color: 'var(--red)' },
  resubmitted: { icon: 'bi-arrow-repeat', verb: 'resubmitted this', color: 'var(--gold)' },
};

export function ApprovalDetail({ id }: { id: number }) {
  const { data: session } = useSession();
  const { data, loading, error, refetch } = useFetch<ApprovalDetailDTO>(approvalDetailUrl(id));

  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [decisionComment, setDecisionComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showResubmit, setShowResubmit] = useState(false);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return <Card><ErrorState message={error} onRetry={refetch} /></Card>;
  }
  if (!data) return null;

  const { submission, events, reviewers, canDecide } = data;
  const isSubmitter = session?.user?.id === String(submission.submittedBy);
  const canResubmit = isSubmitter && submission.status === 'rejected';

  async function postComment() {
    if (!comment.trim()) return;
    setPosting(true);
    setActionError('');
    try {
      await addApprovalComment(id, comment.trim());
      setComment('');
      refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  }

  async function decide(decision: 'approved' | 'rejected') {
    setDeciding(true);
    setActionError('');
    try {
      await decideApproval(id, decision, decisionComment.trim() || undefined);
      setDecisionComment('');
      refetch();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to record decision.');
    } finally {
      setDeciding(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/approvals" className="text-xs font-semibold" style={{ color: 'var(--gold)' }}>
        ← Back to Approvals
      </Link>

      <Card padded={false} className="overflow-hidden">
        {submission.imagePath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={submission.imagePath} alt={submission.title ?? 'Submission'} className="max-h-[480px] w-full object-contain" style={{ background: 'var(--surface-2)' }} />
        )}
        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <ApprovalStatusPill status={submission.status} />
            {submission.clientName && (
              <span className="status-pill status-neutral">{submission.clientName}</span>
            )}
            {submission.campaignName && (
              <span className="status-pill status-neutral">{submission.campaignName}</span>
            )}
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {submission.title || 'Untitled submission'}
          </h1>
          {submission.caption && (
            <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)' }}>
              {submission.caption}
            </p>
          )}
          <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Submitted by <strong>{submission.submittedByName}</strong> on {formatDateTime(submission.createdAt)}
          </p>
          {reviewers.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <i className="bi bi-person-check" aria-hidden="true" />
              Approval requested from:
              {reviewers.map((r) => (
                <span
                  key={r.userId}
                  className="rounded-full px-2 py-0.5 font-semibold"
                  style={{ background: 'var(--status-neutral-bg)', color: 'var(--text-secondary)' }}
                >
                  {r.name}
                </span>
              ))}
            </p>
          )}
        </div>
      </Card>

      {actionError && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
          {actionError}
        </div>
      )}

      {canDecide && (
        <Card>
          <h2 className="ice-section-title mb-3 text-sm">Your decision</h2>
          <textarea
            className="ice-search mb-3 w-full text-sm"
            rows={2}
            placeholder="Optional comment (recommended when rejecting)"
            value={decisionComment}
            onChange={(e) => setDecisionComment(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => void decide('approved')}
              disabled={deciding}
              className="ice-pill-btn-gold flex-1 justify-center py-2 text-sm disabled:opacity-60"
            >
              <i className="bi bi-check-lg" aria-hidden="true" /> Approve
            </button>
            <button
              onClick={() => void decide('rejected')}
              disabled={deciding}
              className="flex-1 rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--red)' }}
            >
              <i className="bi bi-x-lg" aria-hidden="true" /> Reject
            </button>
          </div>
        </Card>
      )}

      {canResubmit && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              This was rejected. You can update it and resubmit for another review.
            </p>
            <button onClick={() => setShowResubmit(true)} className="ice-pill-btn-gold py-1.5 text-xs">
              Resubmit
            </button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="ice-section-title mb-3 text-sm">History</h2>
        <div className="space-y-3">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>

        <div className="mt-4 flex gap-2 border-t pt-4" style={{ borderColor: 'var(--card-border)' }}>
          <input
            className="ice-search flex-1 text-sm"
            placeholder="Add a comment…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void postComment()}
          />
          <button
            onClick={() => void postComment()}
            disabled={posting || !comment.trim()}
            className="ice-pill-btn-gold py-1.5 text-xs disabled:opacity-60"
          >
            {posting ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Post'}
          </button>
        </div>
      </Card>

      {showResubmit && (
        <ResubmitModal
          id={id}
          onClose={() => setShowResubmit(false)}
          onDone={() => { setShowResubmit(false); refetch(); }}
        />
      )}
    </div>
  );
}

function EventRow({ event }: { event: ApprovalEventDTO }) {
  const meta = EVENT_META[event.eventType] ?? { icon: 'bi-dot', verb: event.eventType, color: 'var(--text-muted)' };
  return (
    <div className="flex gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs"
        style={{ background: 'var(--surface-2)', color: meta.color }}
      >
        <i className={`bi ${meta.icon}`} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
          <strong>{event.actorName}</strong> {meta.verb}
          <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {formatDateTime(event.createdAt)}
          </span>
        </p>
        {event.comment && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {event.comment}
          </p>
        )}
      </div>
    </div>
  );
}

function ResubmitModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      await resubmitApproval(id, {
        title: title || undefined,
        caption: caption || undefined,
        image: file ?? undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resubmit failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,8,42,0.5)' }}>
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)', boxShadow: '0 24px 60px rgba(20,8,42,0.18)' }}
      >
        <h3 className="mb-4 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Resubmit for approval
        </h3>
        <div className="space-y-3">
          <input
            className="ice-search w-full text-sm"
            placeholder="New title (optional — keeps current if blank)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="ice-search w-full text-sm"
            rows={3}
            placeholder="New caption (optional — keeps current if blank)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs"
          />
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
              disabled={submitting}
              className="ice-pill-btn-gold flex-1 justify-center py-2.5 text-sm disabled:opacity-60"
            >
              {submitting ? <i className="bi bi-arrow-repeat animate-spin" /> : 'Resubmit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
