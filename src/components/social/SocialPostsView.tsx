'use client';

import { useState, useCallback } from 'react';
import { useFetch } from '@/lib/use-fetch';
import {
  zohoStatusUrl,
  zohoPostsUrl,
  zohoSummaryUrl,
  zohoInsightsUrl,
  zohoDisconnect,
  zohoSync,
  generateSocialPost,
} from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type {
  ZohoSocialStatusDTO,
  ZohoSocialPostDTO,
  ZohoSocialSummaryDTO,
  AiSocialInsightDTO,
  AiPostDraftDTO,
} from '@/lib/types';

// ── Network helpers ────────────────────────────────────────────────────────

const NETWORK_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E1306C',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  youtube: '#FF0000',
  tiktok: '#000000',
  gmb: '#4285F4',
};

const NETWORK_ICONS: Record<string, string> = {
  facebook: 'bi-facebook',
  instagram: 'bi-instagram',
  linkedin: 'bi-linkedin',
  twitter: 'bi-twitter-x',
  youtube: 'bi-youtube',
  tiktok: 'bi-tiktok',
  gmb: 'bi-google',
};

function networkColor(n: string): string {
  return NETWORK_COLORS[n.toLowerCase()] ?? '#6B7280';
}
function networkIcon(n: string): string {
  return NETWORK_ICONS[n.toLowerCase()] ?? 'bi-share-fill';
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ConnectBanner({ configured }: { configured: boolean }) {
  return (
    <Card>
      <div className="flex flex-col items-center py-8 text-center gap-4">
        <div className="rounded-full p-4" style={{ background: 'var(--surface-2)' }}>
          <i className="bi bi-share-fill text-3xl" style={{ color: '#E05735' }} />
        </div>
        <div>
          <h3 className="ice-section-title text-lg mb-1">Connect Zoho Social</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {configured
              ? 'Click below to authorise ICE Pulse to read your Zoho Social posts and analytics.'
              : 'Zoho Social credentials are not configured. Add ZOHO_SOCIAL_CLIENT_ID, ZOHO_SOCIAL_CLIENT_SECRET, and ZOHO_SOCIAL_ORG_ID to .env.local.'}
          </p>
        </div>
        {configured && (
          <a
            href="/api/zoho-social/connect"
            className="ice-btn-primary inline-flex items-center gap-2"
          >
            <i className="bi bi-box-arrow-in-right" />
            Connect Zoho Social
          </a>
        )}
      </div>
    </Card>
  );
}

function SummaryCards({ data }: { data: ZohoSocialSummaryDTO[] }) {
  if (!data.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
      {data.map((s) => (
        <Card key={s.network} className="!p-3">
          <div className="flex items-center gap-2 mb-2">
            <i
              className={`bi ${networkIcon(s.network)} text-sm`}
              style={{ color: networkColor(s.network) }}
            />
            <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-secondary)' }}>
              {s.network}
            </span>
          </div>
          <div className="text-lg font-bold">{fmtNum(s.totalImpressions)}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>impressions · {s.postCount} posts</div>
          {s.avgEngagementRate != null && (
            <div className="text-xs mt-1" style={{ color: 'var(--green)' }}>
              {s.avgEngagementRate.toFixed(2)}% avg engagement
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function PostCard({ post }: { post: ZohoSocialPostDTO }) {
  const hasImage = post.mediaUrls.length > 0;
  const engRate = post.engagementRate != null ? post.engagementRate.toFixed(2) : null;

  return (
    <Card className="flex flex-col gap-3 !p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-full"
            style={{ background: networkColor(post.network) }}
          >
            <i className={`bi ${networkIcon(post.network)} text-xs text-white`} />
          </span>
          <div>
            <div className="text-xs font-semibold capitalize">{post.network}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {fmtDate(post.publishedAt)}
            </div>
          </div>
        </div>
        {engRate && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--surface-2)', color: 'var(--green)' }}
          >
            {engRate}% engagement
          </span>
        )}
      </div>

      {hasImage && (
        <img
          src={post.mediaUrls[0]}
          alt="Post media"
          className="w-full h-36 object-cover rounded-md"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {post.contentText && (
        <p
          className="text-sm leading-relaxed line-clamp-3"
          style={{ color: 'var(--text-primary)' }}
        >
          {post.contentText}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        {[
          { icon: 'bi-eye', label: 'Impressions', value: post.impressions },
          { icon: 'bi-heart', label: 'Likes', value: post.likes },
          { icon: 'bi-chat', label: 'Comments', value: post.comments },
          { icon: 'bi-share', label: 'Shares', value: post.shares },
          { icon: 'bi-people', label: 'Reach', value: post.reach },
          { icon: 'bi-cursor', label: 'Clicks', value: post.clicks },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-sm font-bold">{fmtNum(m.value)}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <i className={`bi ${m.icon} mr-1`} />{m.label}
            </div>
          </div>
        ))}
      </div>

      {post.permalinkUrl && (
        <a
          href={post.permalinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs"
          style={{ color: 'var(--accent)' }}
        >
          <i className="bi bi-box-arrow-up-right mr-1" />View on {post.network}
        </a>
      )}
    </Card>
  );
}

function InsightsPanel({ aiInsights, loading, onLoad }: {
  aiInsights: AiSocialInsightDTO | null;
  loading: boolean;
  onLoad: () => void;
}) {
  if (loading) return (
    <Card>
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Card>
  );

  if (!aiInsights) {
    return (
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <i className="bi bi-robot text-xl" style={{ color: 'var(--accent)' }} />
            <h3 className="ice-section-title text-base">AI Performance Insights</h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Let AI analyse your post history to surface what content drives the best engagement.
          </p>
          <button onClick={onLoad} className="ice-btn-primary w-fit">
            <i className="bi bi-stars mr-2" />Generate Insights
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <i className="bi bi-robot text-xl" style={{ color: 'var(--accent)' }} />
        <h3 className="ice-section-title text-base">AI Performance Insights</h3>
        <button
          onClick={onLoad}
          className="ml-auto text-xs px-2 py-1 rounded"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          <i className="bi bi-arrow-clockwise mr-1" />Refresh
        </button>
      </div>

      <p className="text-sm mb-4" style={{ color: 'var(--text-primary)' }}>{aiInsights.summary}</p>

      {aiInsights.topPerformers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Top Performers
          </h4>
          <div className="space-y-2">
            {aiInsights.topPerformers.map((tp, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5"
                  style={{ background: networkColor(tp.network) }}
                >
                  <i className={`bi ${networkIcon(tp.network)} text-xs text-white`} />
                </span>
                <span style={{ color: 'var(--text-primary)' }}>{tp.insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {aiInsights.contentTips.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Content Tips
          </h4>
          <ul className="space-y-1">
            {aiInsights.contentTips.map((t, i) => (
              <li key={i} className="text-sm flex gap-2">
                <i className="bi bi-check-circle-fill mt-0.5 shrink-0" style={{ color: 'var(--green)' }} />
                <span style={{ color: 'var(--text-primary)' }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {aiInsights.timingTips.length > 0 && (
        <>
          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
            Best Times to Post
          </h4>
          <ul className="space-y-1">
            {aiInsights.timingTips.map((t, i) => (
              <li key={i} className="text-sm flex gap-2">
                <i className="bi bi-clock mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-primary)' }}>{t}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function PostCreatorPanel() {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional but creative');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(['instagram', 'facebook', 'linkedin']);
  const [draft, setDraft] = useState<AiPostDraftDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const networks = ['instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'tiktok'];

  function toggleNetwork(n: string) {
    setSelectedNetworks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const result = await generateSocialPost({ topic: topic.trim(), networks: selectedNetworks, tone });
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!draft) return;
    const text = `${draft.caption}\n\n${draft.hashtags.map((h) => `#${h}`).join(' ')}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <i className="bi bi-pencil-square text-xl" style={{ color: 'var(--accent)' }} />
        <h3 className="ice-section-title text-base">Smart Post Creator</h3>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        AI generates a caption + hashtags based on your past performance data and the topic you provide.
      </p>

      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
            Topic / Theme *
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. End of financial year sale, new client launch, team milestone..."
            className="ice-input w-full"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>
            Tone
          </label>
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="ice-input w-full"
            placeholder="e.g. professional, playful, urgent..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-muted)' }}>
            Target Networks
          </label>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <button
                key={n}
                onClick={() => toggleNetwork(n)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: selectedNetworks.includes(n) ? networkColor(n) : 'var(--surface-2)',
                  color: selectedNetworks.includes(n) ? '#fff' : 'var(--text-secondary)',
                  border: `2px solid ${selectedNetworks.includes(n) ? networkColor(n) : 'var(--border)'}`,
                }}
              >
                <i className={`bi ${networkIcon(n)} text-xs`} />
                <span className="capitalize">{n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => void handleGenerate()}
        disabled={loading || !topic.trim()}
        className="ice-btn-primary w-full mb-4"
      >
        {loading ? (
          <><i className="bi bi-hourglass-split mr-2 animate-spin" />Generating…</>
        ) : (
          <><i className="bi bi-stars mr-2" />Generate Post</>
        )}
      </button>

      {error && (
        <div className="text-sm p-3 rounded-md mb-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      {draft && (
        <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Generated Draft
            </h4>
            <button
              onClick={handleCopy}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'var(--surface-2)', color: copied ? 'var(--green)' : 'var(--text-secondary)' }}
            >
              <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'} mr-1`} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="p-3 rounded-md text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}>
            {draft.caption}
          </div>

          {draft.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {draft.hashtags.map((h) => (
                <span
                  key={h}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(79,70,229,0.1)', color: 'var(--accent)' }}
                >
                  #{h}
                </span>
              ))}
            </div>
          )}

          {draft.bestTimes.length > 0 && (
            <div>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Best times: </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{draft.bestTimes.join(', ')}</span>
            </div>
          )}

          {draft.rationale && (
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{draft.rationale}</p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────

type Tab = 'posts' | 'insights' | 'create';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'posts', label: 'Social Posts', icon: 'bi-grid-3x3-gap' },
  { key: 'insights', label: 'AI Insights', icon: 'bi-stars' },
  { key: 'create', label: 'Smart Creator', icon: 'bi-pencil-square' },
];

const NETWORKS = ['all', 'facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok'];

export function SocialPostsView() {
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [aiInsights, setAiInsights] = useState<AiSocialInsightDTO | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const statusResp = useFetch<ZohoSocialStatusDTO>(zohoStatusUrl());
  const summaryResp = useFetch<ZohoSocialSummaryDTO[]>(zohoSummaryUrl(30));
  const postsUrl = zohoPostsUrl({ network: filterNetwork !== 'all' ? filterNetwork : undefined, limit: 60 });
  const postsResp = useFetch<ZohoSocialPostDTO[]>(postsUrl);

  const status = statusResp.data;
  const posts = postsResp.data ?? [];
  const summary = summaryResp.data ?? [];
  const connected = status?.connected ?? false;

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await zohoSync();
      setSyncMsg(r.status === 'success' ? 'Sync complete.' : 'Sync failed — check Sync Centre.');
      postsResp.refetch?.();
      summaryResp.refetch?.();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }, [postsResp, summaryResp]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Zoho Social? Synced post data will remain in the database.')) return;
    setDisconnecting(true);
    try {
      await zohoDisconnect();
      statusResp.refetch?.();
    } finally {
      setDisconnecting(false);
    }
  }, [statusResp]);

  const handleLoadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch(zohoInsightsUrl(90));
      if (!res.ok) throw new Error(`Insights failed (${res.status})`);
      const data = (await res.json()) as AiSocialInsightDTO;
      setAiInsights(data);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to load insights.');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  return (
    <>
      <PageHeader
        title="Social Posts"
        subtitle="Organic social performance across all channels, powered by Zoho Social."
      >
        {connected && (
          <>
            {syncMsg && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{syncMsg}</span>
            )}
            <button
              onClick={() => void handleSync()}
              disabled={syncing}
              className="ice-btn-secondary text-sm flex items-center gap-1"
            >
              <i className={`bi bi-arrow-repeat ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
            <button
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
              className="ice-btn-secondary text-sm flex items-center gap-1"
              style={{ color: '#EF4444' }}
            >
              <i className="bi bi-x-circle" />
              Disconnect
            </button>
          </>
        )}
      </PageHeader>

      {/* Connection state */}
      {statusResp.loading && (
        <div className="mb-6 space-y-3">
          <Skeleton className="h-24" />
        </div>
      )}

      {!statusResp.loading && !connected && (
        <div className="mb-6">
          <ConnectBanner configured={status?.configured ?? false} />
        </div>
      )}

      {/* Connected state */}
      {connected && (
        <>
          {/* Stats overview */}
          <SummaryCards data={summary} />

          {/* Tabs */}
          <div className="flex border-b mb-6" style={{ borderColor: 'var(--border)' }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2.5 text-sm font-medium transition-colors relative"
                style={{
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                <i className={`bi ${tab.icon} mr-1.5`} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Posts tab */}
          {activeTab === 'posts' && (
            <>
              {/* Network filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {NETWORKS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setFilterNetwork(n)}
                    className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                    style={{
                      background: filterNetwork === n
                        ? (n === 'all' ? 'var(--accent)' : networkColor(n))
                        : 'var(--surface-2)',
                      color: filterNetwork === n ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {n === 'all' ? (
                      'All Networks'
                    ) : (
                      <><i className={`bi ${networkIcon(n)} mr-1`} />{n.charAt(0).toUpperCase() + n.slice(1)}</>
                    )}
                  </button>
                ))}
              </div>

              {postsResp.loading && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-32" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {!postsResp.loading && posts.length === 0 && (
                <EmptyState
                  icon="bi-chat-square-heart"
                  title="No posts yet"
                  description='Run a sync to pull your Zoho Social posts, or try a different network filter.'
                />
              )}

              {!postsResp.loading && posts.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {posts.map((post) => (
                    <PostCard key={post.zohoPostId} post={post} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* AI Insights tab */}
          {activeTab === 'insights' && (
            <InsightsPanel
              aiInsights={aiInsights}
              loading={insightsLoading}
              onLoad={() => void handleLoadInsights()}
            />
          )}

          {/* Smart Creator tab */}
          {activeTab === 'create' && <PostCreatorPanel />}
        </>
      )}
    </>
  );
}
