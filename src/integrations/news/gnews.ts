import { getGNewsConfig } from '@/server/config/env';

export interface RawGNewsArticle {
  title: string;
  url: string;
  source: { name: string };
  publishedAt: string;
  description: string | null;
  image: string | null;
}

interface GNewsResponse {
  articles?: RawGNewsArticle[];
  errors?: string[];
}

export class GNewsRateLimitError extends Error {
  readonly status = 429;
  constructor() {
    super('GNews rate limit reached (100 req/day on free plan). Serving cached results.');
    this.name = 'GNewsRateLimitError';
  }
}

/** Fetches news articles from GNews API matching any of the given keywords. */
export async function fetchGNewsArticles(
  keywords: string[],
  max = 10,
): Promise<RawGNewsArticle[]> {
  if (keywords.length === 0) return [];
  const { apiKey } = getGNewsConfig();
  const query = keywords.map((k) => `"${k}"`).join(' OR ');
  const url =
    `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}` +
    `&token=${apiKey}&lang=en&max=${max}&sortby=publishedAt`;

  const resp = await fetch(url, { next: { revalidate: 0 } });
  if (resp.status === 429) throw new GNewsRateLimitError();
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`GNews API error ${resp.status}: ${body.slice(0, 200)}`);
  }

  const data = (await resp.json()) as GNewsResponse;
  if (data.errors?.length) {
    throw new Error(`GNews error: ${data.errors.join(', ')}`);
  }
  return data.articles ?? [];
}

/** Normalised article key for de-duplication (same story from different feeds/URLs). */
function articleKey(a: RawGNewsArticle): string {
  return a.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * Fetches a DIVERSE feed by querying keywords in small groups (one query per
 * group) and merging the results, deduped by story. A single OR query returns
 * the same handful of top-of-mind articles every time; querying per group
 * surfaces coverage across every topic the team tracks. Bounded to `maxGroups`
 * requests so the GNews free-tier daily quota is respected.
 */
export async function fetchGNewsDiverse(
  keywords: string[],
  opts: { groupSize?: number; maxGroups?: number; perGroup?: number } = {},
): Promise<RawGNewsArticle[]> {
  const { groupSize = 3, maxGroups = 5, perGroup = 10 } = opts;
  if (keywords.length === 0) return [];

  // Chunk into groups, then cap how many group-queries we run this fetch.
  const groups: string[][] = [];
  for (let i = 0; i < keywords.length; i += groupSize) {
    groups.push(keywords.slice(i, i + groupSize));
  }
  const selected = groups.slice(0, maxGroups);

  const results = await Promise.allSettled(selected.map((g) => fetchGNewsArticles(g, perGroup)));

  // If EVERY group hit the rate limit, surface that so the caller can serve cache.
  if (results.length > 0 && results.every((r) => r.status === 'rejected' && r.reason instanceof GNewsRateLimitError)) {
    throw new GNewsRateLimitError();
  }

  const seen = new Set<string>();
  const merged: RawGNewsArticle[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const a of r.value) {
      const key = articleKey(a);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(a);
    }
  }
  // Freshest first.
  merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return merged;
}
