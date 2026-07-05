'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/use-fetch';
import { formatNumber } from '@/lib/format';
import type { MetaSocialFeedDTO, MetaSocialPostDTO, PostIdeaDTO } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';

const PLATFORM_ICON: Record<string, { icon: string; color: string }> = {
  facebook: { icon: 'bi-facebook', color: '#1877F2' },
  instagram: { icon: 'bi-instagram', color: '#E4405F' },
  linkedin: { icon: 'bi-linkedin', color: '#0A66C2' },
};

function IdeaCard({ idea }: { idea: PostIdeaDTO }) {
  const [copied, setCopied] = useState(false);
  const p = PLATFORM_ICON[idea.platform] ?? PLATFORM_ICON.facebook;
  const fullText = [idea.caption, idea.hashtags].filter(Boolean).join('\n\n');

  return (
    <Card className="flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
          <i className={`bi ${p.icon}`} style={{ color: p.color }} aria-hidden="true" />
          {idea.platform}
          <span style={{ color: 'var(--text-muted)' }}>· {idea.ideaDate}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(fullText).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
          className="ice-icon-btn h-7 w-7 text-xs"
          title="Copy caption + hashtags"
          aria-label="Copy caption and hashtags"
        >
          <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`} aria-hidden="true" />
        </button>
      </div>

      <p className="mb-2 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {idea.caption}
      </p>
      {idea.hashtags && (
        <p className="mb-2 text-[12px] font-medium" style={{ color: 'var(--violet)' }}>
          {idea.hashtags}
        </p>
      )}
      {idea.imageBrief && (
        <p className="rounded-lg px-3 py-2 text-[11px] leading-relaxed" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
          <i className="bi bi-palette mr-1" aria-hidden="true" />
          <strong>For the designer (ICE brand template):</strong> {idea.imageBrief}
        </p>
      )}
      {idea.newsHook && (
        <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <i className="bi bi-newspaper mr-1" aria-hidden="true" />
          Rides on: {idea.newsHook}
        </p>
      )}
      <a
        href={`/approvals?title=${encodeURIComponent(`Social post — ${idea.platform}`)}&caption=${encodeURIComponent(fullText)}`}
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold"
        style={{ color: 'var(--text-secondary)' }}
      >
        <i className="bi bi-check2-square" style={{ color: 'var(--green)' }} aria-hidden="true" />
        Send for approval (attach the image there) →
      </a>
    </Card>
  );
}

function PostIdeasSection() {
  const { data, loading, refetch } = useFetch<{ ideas: PostIdeaDTO[] }>('/api/social/post-ideas?days=7');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  async function generateNow() {
    setGenerating(true);
    setGenError('');
    try {
      const res = await fetch('/api/social/post-ideas', { method: 'POST' });
      const body = (await res.json()) as { stored?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      refetch();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="ice-section-title flex items-center gap-2 text-base">
          AI post ideas
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
            style={{ background: 'var(--ai-bg)', color: 'var(--text-secondary)', border: '1px solid var(--ai-border)' }}
          >
            DAILY
          </span>
        </h2>
        <button type="button" onClick={() => void generateNow()} disabled={generating} className="ice-action-chip">
          <i className={`bi ${generating ? 'bi-arrow-repeat animate-spin' : 'bi-stars'}`} aria-hidden="true" />
          {generating ? 'Writing…' : 'Generate fresh ideas'}
        </button>
      </div>
      {genError && (
        <p className="mb-3 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
          {genError}
        </p>
      )}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      )}
      {!loading && data && data.ideas.length === 0 && (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No ideas yet — a fresh batch is drafted automatically every day, or click{' '}
            <strong>Generate fresh ideas</strong> to get some now. Captions and hashtags are ready to
            post; each idea includes a brief for the design team to produce the image in the ICE brand
            templates.
          </p>
        </Card>
      )}
      {!loading && data && data.ideas.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.ideas.slice(0, 6).map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days > 30) return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  return 'just now';
}

function Engagement({ icon, count, label }: { icon: string; count: number; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }} title={label}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      {formatNumber(count)}
    </span>
  );
}

function PostCard({ post }: { post: MetaSocialPostDTO }) {
  return (
    <Card padded={false} className="flex flex-col overflow-hidden">
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" className="h-44 w-full object-cover" loading="lazy" />
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className="truncate rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'var(--status-neutral-bg)', color: 'var(--text-secondary)' }}
          >
            <i className="bi bi-facebook mr-1" style={{ color: '#1877F2' }} aria-hidden="true" />
            {post.pageName}
          </span>
          <span className="shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(post.createdTime)}
          </span>
        </div>

        <p className="mb-3 line-clamp-4 flex-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {post.message ?? <em style={{ color: 'var(--text-muted)' }}>No caption</em>}
        </p>

        <div className="flex items-center gap-3.5">
          <Engagement icon="bi-hand-thumbs-up" count={post.likes} label="Likes" />
          <Engagement icon="bi-chat" count={post.comments} label="Comments" />
          <Engagement icon="bi-share" count={post.shares} label="Shares" />
          {post.permalinkUrl && (
            <a
              href={post.permalinkUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-[11px] font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              View post <i className="bi bi-box-arrow-up-right text-[9px]" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

export function MetaSocialView() {
  const [pageFilter, setPageFilter] = useState<string>('');
  const { data, loading, error, refetch } = useFetch<MetaSocialFeedDTO>('/api/social/feed');

  const posts = data?.posts.filter((p) => !pageFilter || p.pageId === pageFilter) ?? [];

  return (
    <>
      <PageHeader
        title="Social Posts"
        subtitle="Organic Facebook & Instagram posts pulled live from Meta, plus fresh AI post ideas every day."
      >
        <button type="button" onClick={refetch} className="ice-pill-btn-ghost" disabled={loading}>
          <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
      </PageHeader>

      <PostIdeasSection />

      {/* Best posting times — from real engagement on recent posts */}
      {data && (!data.bestTimes || data.bestTimes.length === 0) && (
        <div className="mb-6 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
          <i className="bi bi-clock-history" aria-hidden="true" />
          <span>
            <strong>Best times to post</strong> will appear here once your Facebook Page is connected and has
            at least 5 posts with engagement — computed from your real likes, comments and shares.
          </span>
        </div>
      )}
      {data?.bestTimes && data.bestTimes.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            <i className="bi bi-clock-history mr-1.5" aria-hidden="true" />
            Best times to post (by engagement):
          </span>
          {data.bestTimes.map((slot, i) => (
            <span
              key={slot.label}
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: i === 0 ? 'rgba(255,213,0,0.15)' : 'var(--surface)',
                border: '1px solid var(--card-border)',
                color: 'var(--text-primary)',
              }}
              title={`${slot.posts} posts · avg ${slot.avgEngagement} interactions`}
            >
              {i === 0 && <i className="bi bi-trophy-fill mr-1" style={{ color: 'var(--gold)' }} aria-hidden="true" />}
              {slot.label}
              <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
                ~{slot.avgEngagement}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Page filter chips */}
      {data && data.pages.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPageFilter('')}
            className="ice-action-chip"
            style={!pageFilter ? { background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' } : undefined}
          >
            All pages
          </button>
          {data.pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPageFilter(p.id)}
              className="ice-action-chip"
              style={pageFilter === p.id ? { background: 'var(--indigo)', color: '#fff', borderColor: 'var(--indigo)' } : undefined}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <Card>
          <ErrorState message={error} onRetry={refetch} />
        </Card>
      )}

      {!error && loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      )}

      {!error && !loading && data && data.notice && (
        <Card>
          <EmptyState
            icon={data.configured ? 'bi-facebook' : 'bi-gear'}
            title={data.configured ? 'Connect your Facebook Page' : 'Meta is not configured'}
            description={data.notice}
          />
        </Card>
      )}

      {!error && !loading && data && !data.notice && posts.length === 0 && (
        <Card>
          <EmptyState
            icon="bi-chat-square-heart"
            title="No posts yet"
            description="The connected page hasn't published any posts, or they haven't appeared in the feed yet."
          />
        </Card>
      )}

      {!error && !loading && posts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </>
  );
}
