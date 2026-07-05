'use client';

import { useState, useCallback } from 'react';
import { useFetch } from '@/lib/use-fetch';
import {
  newsKeywordsUrl,
  newsFeedUrl,
  marketingCalendarUrl,
  addNewsKeyword,
  deleteNewsKeyword,
  suggestNewsKeywords,
} from '@/lib/api-client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { NewsKeywordDTO, NewsArticleDTO, MarketingCalendarEventDTO } from '@/lib/types';

interface KeywordsResp { keywords: NewsKeywordDTO[] }
interface FeedResp { articles: NewsArticleDTO[]; rateLimited: boolean }
interface CalendarResp { events: MarketingCalendarEventDTO[]; month: string }

const CATEGORY_COLORS: Record<string, string> = {
  holiday: '#FF9D4D',
  sporting: '#4285F4',
  awareness: '#22D3A0',
  cultural: '#C79DFE',
  seasonal: '#FFD500',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-AU', { month: 'long', year: 'numeric' });
}

function prevMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function NewsInsightsView() {
  const [activeTab, setActiveTab] = useState<'feed' | 'calendar'>('feed');
  const [feedUrl, setFeedUrl] = useState(newsFeedUrl(false));
  const [calMonth, setCalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [newKw, setNewKw] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const kwQ = useFetch<KeywordsResp>(newsKeywordsUrl());
  const feedQ = useFetch<FeedResp>(feedUrl);
  const calQ = useFetch<CalendarResp>(marketingCalendarUrl(calMonth));

  const [newIsCompetitor, setNewIsCompetitor] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    const kw = newKw.trim();
    if (!kw) return;
    setAdding(true);
    setAddError('');
    try {
      await addNewsKeyword(kw, null, newIsCompetitor);
      setNewKw('');
      setNewIsCompetitor(false);
      kwQ.refetch();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add keyword');
    } finally {
      setAdding(false);
    }
  }, [newKw, newIsCompetitor, kwQ]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteNewsKeyword(id);
        kwQ.refetch();
      } catch {
        // silent – keyword stays in list
      }
    },
    [kwQ],
  );

  const handleSuggest = useCallback(async () => {
    setSuggesting(true);
    setSuggestError('');
    try {
      const kws = await suggestNewsKeywords();
      setSuggested(kws);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Failed to suggest keywords');
    } finally {
      setSuggesting(false);
    }
  }, []);

  const handleAddSuggested = useCallback(
    async (kw: string) => {
      setAddingSuggestion(kw);
      try {
        await addNewsKeyword(kw, null, false);
        setSuggested((prev) => prev.filter((k) => k !== kw));
        kwQ.refetch();
      } catch {
        // silent – suggestion stays in list, user can retry
      } finally {
        setAddingSuggestion(null);
      }
    },
    [kwQ],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setFeedUrl(newsFeedUrl(true));
    // after a tick, reset to non-force URL so next load uses cache
    setTimeout(() => setFeedUrl(newsFeedUrl(false)), 100);
    setRefreshing(false);
  }, []);

  const keywords = kwQ.data?.keywords ?? [];
  const articles = feedQ.data?.articles ?? [];
  const rateLimited = feedQ.data?.rateLimited ?? false;
  const calEvents = calQ.data?.events ?? [];

  return (
    <>
      <PageHeader
        title="News Insights"
        subtitle="Stay informed. Find the story behind the campaign."
      >
        {activeTab === 'feed' && (
          <button
            className="ice-btn ice-btn-ghost text-xs"
            onClick={handleRefresh}
            disabled={refreshing || feedQ.loading}
          >
            <i className="bi bi-arrow-clockwise mr-1" aria-hidden="true" />
            Refresh Feed
          </button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ── Keyword sidebar ─────────────────────────────────────────── */}
        <aside className="w-full shrink-0 lg:w-64">
          <Card>
            <p
              className="mb-3 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Keywords
            </p>

            {/* Add keyword form */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  className="ice-input flex-1 text-xs"
                  placeholder="e.g. digital marketing"
                  value={newKw}
                  onChange={(e) => setNewKw(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  maxLength={200}
                />
                <button
                  className="ice-btn ice-btn-primary text-xs"
                  onClick={handleAdd}
                  disabled={adding || !newKw.trim()}
                >
                  Add
                </button>
              </div>
              <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={newIsCompetitor}
                  onChange={(e) => setNewIsCompetitor(e.target.checked)}
                  style={{ accentColor: 'var(--orange)' }}
                />
                This is a competitor — flag their stories with response angles
              </label>
              {addError && (
                <p className="mt-1 text-[11px]" style={{ color: 'var(--red)' }}>
                  {addError}
                </p>
              )}
            </div>

            {/* Keyword list */}
            {kwQ.loading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            )}
            {!kwQ.loading && keywords.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Add keywords to start tracking news.
              </p>
            )}
            {keywords.map((kw) => (
              <div
                key={kw.id}
                className="mb-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                style={{ background: 'var(--surface)' }}
              >
                <span className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--text-primary)' }}>
                  {kw.keyword}
                </span>
                {kw.isCompetitor && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                    style={{ background: 'var(--status-paused-bg)', color: 'var(--status-paused-text)' }}
                  >
                    Competitor
                  </span>
                )}
                {kw.clientName && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'var(--ai-border)', color: 'var(--text-secondary)' }}
                  >
                    {kw.clientName}
                  </span>
                )}
                <button
                  className="shrink-0 text-xs hover:text-red-500"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => handleDelete(kw.id)}
                  title="Remove keyword"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              </div>
            ))}

            {/* AI keyword suggestions */}
            <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--card-border)' }}>
              <button
                className="ice-btn ice-btn-ghost w-full text-xs"
                onClick={handleSuggest}
                disabled={suggesting}
              >
                <i className="bi bi-stars mr-1.5" style={{ color: 'var(--violet)' }} aria-hidden="true" />
                {suggesting ? 'Thinking…' : 'Suggest keywords (AI)'}
              </button>
              {suggestError && (
                <p className="mt-1 text-[11px]" style={{ color: 'var(--red)' }}>
                  {suggestError}
                </p>
              )}
              {suggested.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {suggested.map((kw) => (
                    <div
                      key={kw}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                      style={{ background: 'var(--surface)' }}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs" style={{ color: 'var(--text-primary)' }}>
                        {kw}
                      </span>
                      <button
                        className="shrink-0 text-xs"
                        style={{ color: 'var(--gold)' }}
                        onClick={() => handleAddSuggested(kw)}
                        disabled={addingSuggestion === kw}
                        title="Add keyword"
                      >
                        <i className="bi bi-plus-circle-fill" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Setup notice */}
            {feedQ.error === 'not_configured' && (
              <div
                className="mt-4 rounded-lg p-3 text-[11px] leading-relaxed"
                style={{ background: 'var(--status-paused-bg)', color: 'var(--text-secondary)' }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>Live news disabled.</strong>
                <br />
                Add <code>GNEWS_API_KEY</code> to <code>.env.local</code> (free key from gnews.io).
              </div>
            )}
          </Card>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Tab bar */}
          <div className="mb-4 flex gap-1 border-b" style={{ borderColor: 'var(--card-border)' }}>
            {(['feed', 'calendar'] as const).map((tab) => (
              <button
                key={tab}
                className="px-4 pb-2 text-sm font-medium transition-colors"
                style={{
                  color: activeTab === tab ? 'var(--gold)' : 'var(--text-muted)',
                  borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
                }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'feed' ? 'News Feed' : 'Marketing Calendar'}
              </button>
            ))}
          </div>

          {/* ── News Feed tab ──────────────────────────────────────────── */}
          {activeTab === 'feed' && (
            <>
              {keywords.length === 0 && !kwQ.loading && (
                <EmptyState
                  icon="bi-newspaper"
                  title="Add a keyword to get started"
                  description="Add keywords on the left to pull in relevant news articles and get AI-generated creative hooks."
                />
              )}

              {keywords.length > 0 && feedQ.loading && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <Skeleton className="mb-3 h-36 w-full rounded-lg" />
                      <Skeleton className="mb-2 h-4 w-3/4" />
                      <Skeleton className="mb-1 h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </Card>
                  ))}
                </div>
              )}

              {feedQ.error && feedQ.error !== 'not_configured' && (
                <div
                  className="rounded-xl p-4 text-sm"
                  style={{ background: 'var(--status-removed-bg)', color: 'var(--red)' }}
                >
                  <i className="bi bi-exclamation-triangle mr-2" aria-hidden="true" />
                  {feedQ.error}
                </div>
              )}

              {rateLimited && (
                <div
                  className="mb-4 rounded-xl px-4 py-3 text-xs"
                  style={{ background: 'var(--status-paused-bg)', color: 'var(--text-secondary)' }}
                >
                  <i className="bi bi-hourglass-split mr-1.5" aria-hidden="true" />
                  GNews daily limit reached (100 req/day on free plan). Showing cached articles — fresh results available tomorrow.
                </div>
              )}

              {!feedQ.loading && articles.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {articles.map((a, i) => (
                    <ArticleCard key={`${a.url}-${i}`} article={a} />
                  ))}
                </div>
              )}

              {!feedQ.loading && keywords.length > 0 && articles.length === 0 && !feedQ.error && (
                <EmptyState
                  icon="bi-newspaper"
                  title="No articles found"
                  description="Try different keywords or click Refresh Feed to fetch the latest news."
                />
              )}
            </>
          )}

          {/* ── Marketing Calendar tab ────────────────────────────────── */}
          {activeTab === 'calendar' && (
            <MarketingCalendarTab
              events={calEvents}
              loading={calQ.loading}
              error={calQ.error}
              month={calMonth}
              onPrev={() => setCalMonth(prevMonth(calMonth))}
              onNext={() => setCalMonth(nextMonth(calMonth))}
            />
          )}
        </div>
      </div>
    </>
  );
}

function ArticleCard({ article }: { article: NewsArticleDTO }) {
  return (
    <Card>
      {article.imageUrl && (
        <img
          src={article.imageUrl}
          alt=""
          className="mb-3 h-36 w-full rounded-lg object-cover"
          loading="lazy"
        />
      )}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: 'var(--ai-border)', color: 'var(--text-secondary)' }}
        >
          {article.source}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {formatDate(article.publishedAt)}
        </span>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-2 block text-sm font-semibold leading-snug hover:underline"
        style={{ color: 'var(--text-primary)' }}
      >
        {article.title}
      </a>
      {article.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {article.description}
        </p>
      )}
      {article.marketingHook && (
        <div
          className="rounded-lg border-l-4 px-3 py-2 text-xs leading-relaxed"
          style={{
            borderColor: 'var(--gold)',
            background: 'var(--status-paused-bg)',
            color: 'var(--text-primary)',
          }}
        >
          <i className="bi bi-lightbulb-fill mr-1.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
          {article.marketingHook}
          <div className="mt-2">
            <a
              href={`/ad-copy?hook=${encodeURIComponent(article.marketingHook)}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: 'var(--text-secondary)' }}
            >
              <i className="bi bi-stars" style={{ color: 'var(--violet)' }} aria-hidden="true" />
              Create ad copy from this hook →
            </a>
          </div>
        </div>
      )}
    </Card>
  );
}

function MarketingCalendarTab({
  events,
  loading,
  error,
  month,
  onPrev,
  onNext,
}: {
  events: MarketingCalendarEventDTO[];
  loading: boolean;
  error: string | null;
  month: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Group by date
  const grouped: Record<string, MarketingCalendarEventDTO[]> = {};
  for (const e of events) {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  }
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div>
      {/* Month navigator */}
      <div className="mb-5 flex items-center gap-3">
        <button className="ice-btn ice-btn-ghost text-xs" onClick={onPrev}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {monthLabel(month)}
        </h2>
        <button className="ice-btn ice-btn-ghost text-xs" onClick={onNext}>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {error === 'not_configured' && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: 'var(--status-paused-bg)', color: 'var(--text-secondary)' }}
        >
          AI must be enabled to generate the marketing calendar. Set <code>AI_ENABLED=true</code> and{' '}
          <code>OPENAI_API_KEY</code> in <code>.env.local</code>.
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <EmptyState
          icon="bi-calendar3"
          title="No events generated yet"
          description="The AI marketing calendar will appear here once generated."
        />
      )}

      {!loading && sortedDates.length > 0 && (
        <div className="space-y-3">
          {sortedDates.map((date) => (
            <div key={date} className="flex gap-3">
              <div className="w-24 shrink-0 pt-1 text-right">
                <span
                  className="inline-block rounded-lg px-2 py-1 text-[11px] font-bold"
                  style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
                >
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
              <div className="flex-1 space-y-2">
                {grouped[date].map((e, i) => (
                  <CalendarEventRow key={i} event={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarEventRow({ event }: { event: MarketingCalendarEventDTO }) {
  const color = CATEGORY_COLORS[event.category] ?? '#A78BFA';
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--surface)', borderLeft: `3px solid ${color}` }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {event.event}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize"
          style={{ background: color + '22', color }}
        >
          {event.category}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {event.marketingRelevance}
      </p>
    </div>
  );
}
