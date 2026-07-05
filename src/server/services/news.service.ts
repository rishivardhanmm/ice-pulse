import { createHash } from 'node:crypto';
import { runAi } from '@/ai/run';
import { fetchGNewsDiverse, GNewsRateLimitError } from '@/integrations/news/gnews';
import { isAiConfigured } from '@/server/config/env';
import {
  listKeywords,
  addKeyword,
  deleteKeyword,
  getCachedFeed,
  getStaleCachedFeed,
  saveFeedCache,
} from '@/server/db/repositories/news.repo';
import { logger } from '@/server/logger';
import type { MarketingCalendarEventDTO, NewsArticleDTO, NewsKeywordDTO } from '@/lib/types';

export async function getNewsKeywords(): Promise<NewsKeywordDTO[]> {
  return listKeywords();
}

export async function addNewsKeyword(p: {
  keyword: string;
  clientId: number | null;
  userId: number;
  isCompetitor?: boolean;
}): Promise<NewsKeywordDTO> {
  const id = await addKeyword({
    keyword: p.keyword,
    clientId: p.clientId,
    createdBy: p.userId,
    isCompetitor: p.isCompetitor,
  });
  const all = await listKeywords();
  return (
    all.find((k) => k.id === id) ?? {
      id,
      keyword: p.keyword,
      clientId: p.clientId,
      clientName: null,
      isCompetitor: Boolean(p.isCompetitor),
      createdAt: new Date().toISOString(),
    }
  );
}

export async function removeNewsKeyword(id: number): Promise<void> {
  await deleteKeyword(id);
}

/**
 * AI-suggested new keywords to broaden the news feed — grounded in what the
 * team already tracks plus the agency's focus (behaviour-change / public
 * health / social marketing). Excludes anything already added.
 */
export async function suggestNewsKeywords(): Promise<string[]> {
  if (!isAiConfigured()) return [];
  const existing = (await listKeywords()).map((k) => k.keyword);
  const existingLower = new Set(existing.map((k) => k.toLowerCase()));

  const system =
    'You help a UK behaviour-change / public-health creative agency (ICE Creates) broaden its news monitoring. ' +
    'Suggest fresh, specific news search keywords that would surface stories relevant to their work — public ' +
    'health, behaviour change, social marketing, NHS/local-government campaigns, wellbeing, health inequalities, ' +
    'and adjacent cultural moments they could newsjack. Prefer 2-4 word phrases a journalist would actually use. ' +
    'Avoid duplicates and near-duplicates of the existing list. Respond with a JSON object: ' +
    '{"keywords": string[] (8-12 suggestions)}.';
  const user =
    existing.length > 0
      ? `Already tracked (do NOT repeat these or close variants):\n${existing.join(', ')}`
      : 'No keywords tracked yet — suggest a strong starter set.';

  try {
    const result = await runAi(
      'news_keyword_suggest',
      { system, messages: [{ role: 'user', content: user }], json: true, maxTokens: 300 },
      { existing: existing.length },
    );
    const parsed = JSON.parse(result.text) as { keywords?: unknown };
    const list = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    const seen = new Set<string>();
    return list
      .filter((k): k is string => typeof k === 'string')
      .map((k) => k.trim())
      .filter((k) => k.length >= 2 && k.length <= 60)
      .filter((k) => {
        const lower = k.toLowerCase();
        if (existingLower.has(lower) || seen.has(lower)) return false;
        seen.add(lower);
        return true;
      })
      .slice(0, 12);
  } catch (err) {
    logger.error('Failed to suggest news keywords', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── News feed ─────────────────────────────────────────────────────────────────

export interface NewsFeedResult {
  articles: NewsArticleDTO[];
  /** true when GNews rate limit was hit and we're serving stale/empty cache */
  rateLimited?: boolean;
}

/**
 * Starter keywords seeded the first time the feed loads with nothing
 * configured — the page should never be an empty dead-end. The team can
 * delete or replace them from the keyword sidebar.
 */
const DEFAULT_KEYWORDS = [
  'public health campaign',
  'NHS campaign',
  'behaviour change',
  'digital marketing UK',
  'stop smoking campaign',
  'mental health awareness',
  'health inequalities',
  'social marketing',
  'community wellbeing',
  'physical activity campaign',
  'healthy eating campaign',
  'local government health',
];

export async function getNewsFeed(force = false, seedUserId?: number): Promise<NewsFeedResult> {
  let keywords = await listKeywords();

  if (keywords.length === 0 && seedUserId) {
    logger.info('News feed: no keywords configured — seeding defaults', {
      defaults: DEFAULT_KEYWORDS,
    });
    for (const keyword of DEFAULT_KEYWORDS) {
      await addKeyword({ keyword, clientId: null, createdBy: seedUserId }).catch(() => undefined);
    }
    keywords = await listKeywords();
  }
  if (keywords.length === 0) return { articles: [] };

  const sorted = [...keywords.map((k) => k.keyword)].sort();
  const cacheKey = 'feed_' + createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 32);

  if (!force) {
    const cached = await getCachedFeed(cacheKey);
    if (cached) {
      try {
        return { articles: JSON.parse(cached) as NewsArticleDTO[] };
      } catch {
        // fall through to refetch
      }
    }
  }

  // Fetch a DIVERSE feed: query keywords in small groups and merge+dedupe,
  // instead of one OR query that returns the same handful of stories each time.
  let raw: Awaited<ReturnType<typeof fetchGNewsDiverse>>;
  try {
    raw = await fetchGNewsDiverse(sorted, { groupSize: 3, maxGroups: 5, perGroup: 10 });
  } catch (err) {
    if (err instanceof GNewsRateLimitError) {
      // Serve stale cache (ignoring expiry) rather than crashing
      const stale = await getStaleCachedFeed(cacheKey);
      if (stale) {
        try {
          return { articles: JSON.parse(stale) as NewsArticleDTO[], rateLimited: true };
        } catch {
          // stale cache corrupt
        }
      }
      return { articles: [], rateLimited: true };
    }
    throw err;
  }
  // Cap the merged, deduped feed to a digestible size (also bounds hook tokens).
  raw = raw.slice(0, 18);
  if (raw.length === 0) return { articles: [] };

  // Generate marketing hooks via AI (one batched call). Stories that mention a
  // watched competitor get a "how our clients could respond" angle instead.
  const competitorNames = keywords.filter((k) => k.isCompetitor).map((k) => k.keyword);
  let hooks: string[] = raw.map(() => '');
  if (isAiConfigured()) {
    try {
      const articleList = raw
        .map(
          (a, i) =>
            `${i + 1}. Title: "${a.title}"\n   Description: "${(a.description ?? '').slice(0, 200)}"`,
        )
        .join('\n');

      const competitorNote =
        competitorNames.length > 0
          ? ` COMPETITOR WATCH: these are competitors we monitor: ${competitorNames.join(', ')}. ` +
            'If an article is about one of them, start the hook with "[Competitor]" and make it a sharp ' +
            '1-sentence angle on how our clients could respond or differentiate.'
          : '';

      const result = await runAi(
        'news_hooks',
        {
          system:
            'You are a creative strategist at a marketing agency. Given a list of news articles, write a concise, inspiring 1-sentence creative marketing hook for each one — how could this story spark campaign ideas or content angles for a creative agency? Be specific and punchy.' +
            competitorNote,
          messages: [
            {
              role: 'user',
              content: `Generate a creative marketing hook for each article below. Return a JSON array with exactly ${raw.length} objects, each with "index" (1-based) and "hook" (string). No other text.\n\n${articleList}`,
            },
          ],
          json: true,
          maxTokens: 800,
        },
      );

      const parsed = JSON.parse(result.text) as Array<{ index: number; hook: string }>;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const idx = Number(item.index) - 1;
          if (idx >= 0 && idx < hooks.length) {
            hooks[idx] = String(item.hook || '');
          }
        }
      }
    } catch (err) {
      logger.error('Failed to generate news hooks', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const articles: NewsArticleDTO[] = raw.map((a, i) => ({
    title: a.title,
    url: a.url,
    source: a.source.name,
    publishedAt: a.publishedAt,
    description: a.description ?? '',
    imageUrl: a.image ?? null,
    marketingHook: hooks[i] || 'A creative opportunity worth exploring for your next campaign.',
  }));

  await saveFeedCache(cacheKey, JSON.stringify(articles), 6);
  return { articles };
}

// ── Marketing calendar ─────────────────────────────────────────────────────────

export async function getMarketingCalendar(
  monthStr: string,
): Promise<MarketingCalendarEventDTO[]> {
  const cacheKey = `marketing_calendar_${monthStr}`;

  const cached = await getCachedFeed(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as MarketingCalendarEventDTO[];
    } catch {
      // fall through
    }
  }

  if (!isAiConfigured()) return [];

  const [year, month] = monthStr.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const result = await runAi(
    'marketing_calendar',
    {
      system:
        'You are a marketing calendar expert. You know all holidays, awareness days, sporting events, cultural moments, and seasonal opportunities relevant to creative campaigns globally and in Australia.',
      messages: [
        {
          role: 'user',
          content: `List 15-25 culturally and commercially significant upcoming dates for the month of ${monthName} that a marketing agency could use for campaign planning. Include a good mix of: international holidays, awareness days, sporting events, seasonal moments, and social media trends.\n\nReturn a JSON array. Each item must have:\n- "date": "YYYY-MM-DD"\n- "event": "Name of the occasion"\n- "category": one of "holiday", "sporting", "awareness", "cultural", "seasonal"\n- "marketingRelevance": "One sentence on the campaign opportunity this creates"\n\nReturn only the JSON array, no other text.`,
        },
      ],
      json: true,
      maxTokens: 1500,
    },
  );

  let events: MarketingCalendarEventDTO[] = [];
  try {
    const parsed = JSON.parse(result.text);
    if (Array.isArray(parsed)) {
      events = parsed.map((e) => ({
        date: String(e.date ?? ''),
        event: String(e.event ?? ''),
        category: String(e.category ?? 'cultural'),
        marketingRelevance: String(e.marketingRelevance ?? ''),
      }));
    }
  } catch (err) {
    logger.error('Failed to parse marketing calendar response', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (events.length > 0) {
    await saveFeedCache(cacheKey, JSON.stringify(events), 7 * 24); // 7 days
  }

  return events;
}
