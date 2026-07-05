import { fetchPagePosts, listPages } from '../../integrations/meta-ads/client';
import { friendlyMetaError } from '../../integrations/meta-ads/errors';
import { getMetaAdsConfig, isMetaAdsConfigured } from '../config/env';
import { logger, toErrorMessage } from '../logger';
import type { BestTimeSlotDTO, MetaSocialFeedDTO, MetaSocialPostDTO } from '../../lib/types';

/**
 * Organic Facebook/Instagram page posts via the Meta Graph API — replaces the
 * Zoho Social integration (Zoho Social has no public REST API).
 *
 * Uses the same system-user token as Meta Ads. The Facebook Page(s) must be
 * assigned to that system user in Business Manager (Business settings →
 * Accounts → Pages → Add people/partners) or /me/accounts returns nothing.
 */

const CACHE_TTL_MS = 10 * 60_000;
let cache: { data: MetaSocialFeedDTO; expiresAt: number } | null = null;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_BUCKETS = [
  { start: 6, end: 9, label: '6–9am' },
  { start: 9, end: 12, label: '9am–12pm' },
  { start: 12, end: 15, label: '12–3pm' },
  { start: 15, end: 18, label: '3–6pm' },
  { start: 18, end: 22, label: '6–10pm' },
];

/**
 * Top posting slots by average engagement (likes+comments+shares), grouped by
 * weekday + time bucket. Deterministic — needs at least 5 posts with any
 * engagement to say anything meaningful.
 */
function computeBestTimes(posts: MetaSocialPostDTO[]): BestTimeSlotDTO[] | null {
  const engaged = posts.filter((p) => p.likes + p.comments + p.shares > 0);
  if (engaged.length < 5) return null;

  const slots = new Map<string, { total: number; count: number }>();
  for (const post of engaged) {
    const d = new Date(post.createdTime);
    const hour = d.getHours();
    const bucket = TIME_BUCKETS.find((b) => hour >= b.start && hour < b.end);
    if (!bucket) continue;
    const key = `${WEEKDAYS[d.getDay()]} ${bucket.label}`;
    const cur = slots.get(key) ?? { total: 0, count: 0 };
    cur.total += post.likes + post.comments + post.shares;
    cur.count += 1;
    slots.set(key, cur);
  }

  const ranked = [...slots.entries()]
    .filter(([, v]) => v.count >= 2) // one lucky post isn't a pattern
    .map(([label, v]) => ({
      label,
      avgEngagement: Math.round((v.total / v.count) * 10) / 10,
      posts: v.count,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3);

  return ranked.length > 0 ? ranked : null;
}

const NO_PAGES_NOTICE =
  'The Meta token works, but no Facebook Pages are assigned to it yet. In Meta Business Manager go to ' +
  'Business settings → Accounts → Pages, select your Page, and give the ICE Pulse system user access to it. ' +
  'Posts will appear here automatically once that is done.';

export async function getMetaSocialFeed(force = false): Promise<MetaSocialFeedDTO> {
  if (!isMetaAdsConfigured()) {
    return {
      configured: false,
      pages: [],
      posts: [],
      bestTimes: null,
      notice: 'Meta credentials are not configured. Set META_ACCESS_TOKEN in .env.local.',
    };
  }

  if (!force && cache && Date.now() < cache.expiresAt) return cache.data;

  const cfg = getMetaAdsConfig();
  const pages = await listPages(cfg.apiVersion, cfg.accessToken).catch((err) => {
    logger.error('Meta social: failed to list pages', { error: toErrorMessage(err) });
    throw new Error(friendlyMetaError(err));
  });

  if (pages.length === 0) {
    const data: MetaSocialFeedDTO = {
      configured: true,
      pages: [],
      posts: [],
      bestTimes: null,
      notice: NO_PAGES_NOTICE,
    };
    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
  }

  const postsByPage = await Promise.allSettled(
    pages.map(async (p) => {
      const posts = await fetchPagePosts(cfg.apiVersion, p.id, p.access_token, 25);
      return posts.map<MetaSocialPostDTO>((post) => ({
        id: post.id,
        pageId: p.id,
        pageName: p.name,
        message: post.message ?? null,
        createdTime: post.created_time,
        permalinkUrl: post.permalink_url ?? null,
        imageUrl: post.full_picture ?? null,
        likes: post.likes?.summary?.total_count ?? 0,
        comments: post.comments?.summary?.total_count ?? 0,
        shares: post.shares?.count ?? 0,
      }));
    }),
  );

  const posts: MetaSocialPostDTO[] = [];
  for (const result of postsByPage) {
    if (result.status === 'fulfilled') posts.push(...result.value);
    else logger.error('Meta social: failed to fetch page posts', { error: toErrorMessage(result.reason) });
  }
  posts.sort((a, b) => b.createdTime.localeCompare(a.createdTime));

  const data: MetaSocialFeedDTO = {
    configured: true,
    pages: pages.map((p) => ({ id: p.id, name: p.name, category: p.category ?? null })),
    posts: posts.slice(0, 60),
    bestTimes: computeBestTimes(posts),
    notice: null,
  };
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
