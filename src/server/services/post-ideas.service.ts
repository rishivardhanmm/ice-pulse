import { getPool, sql } from '../db/pool';
import { runAi } from '../../ai/run';
import { getNewsFeed } from './news.service';
import { logger, toErrorMessage } from '../logger';
import type { PostIdeaDTO } from '../../lib/types';

/**
 * Daily AI social-post ideas: caption + hashtags + an image brief the design
 * team can execute inside the ICE brand templates. Grounded in the current
 * News Insights hooks when available, so ideas ride live stories.
 *
 * Idempotent per day — the scheduler job skips generation when today already
 * has ideas, so restarts never duplicate.
 */

const IDEAS_PER_DAY = 3;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RawIdea {
  platform?: string;
  caption?: string;
  hashtags?: string;
  imageBrief?: string;
  newsHook?: string;
}

async function generateIdeas(): Promise<RawIdea[]> {
  // Ride today's news hooks when the feed has any (cached — no extra GNews call).
  const feed = await getNewsFeed(false).catch(() => ({ articles: [] }));
  const hooks = feed.articles
    .map((a) => a.marketingHook)
    .filter((h): h is string => !!h)
    .slice(0, 5);

  const system =
    'You are a senior social media creative at ICE Creates, a UK behaviour-change agency working with ' +
    'public-sector and health clients. Draft distinct organic social post ideas (not paid ads). British English, ' +
    'warm and human, no clickbait or unfounded claims. Each idea needs: "platform" ("facebook"|"instagram"|"linkedin"), ' +
    '"caption" (ready to post, max 500 chars, may include 1-2 tasteful emoji), "hashtags" (3-6, space-separated, with #), ' +
    '"imageBrief" (1-2 sentences telling the designer what to create USING THE ICE BRAND TEMPLATE — subject, mood, ' +
    'text overlay if any), and "newsHook" (the news angle used, or empty string). ' +
    `Respond with a JSON object: {"ideas": [exactly ${IDEAS_PER_DAY} idea objects]}.`;

  const user =
    hooks.length > 0
      ? `Today's newsjacking angles from our news feed — use at least one where it fits naturally:\n${hooks
          .map((h, i) => `${i + 1}. ${h}`)
          .join('\n')}`
      : 'No live news angles today — draft evergreen ideas around public health, behaviour change and community impact.';

  const result = await runAi(
    'post_ideas',
    { system, messages: [{ role: 'user', content: user }], json: true, maxTokens: 900 },
    { hooks: hooks.length },
  );

  try {
    const parsed = JSON.parse(result.text) as { ideas?: RawIdea[] };
    return Array.isArray(parsed.ideas) ? parsed.ideas : [];
  } catch {
    logger.warn('Post ideas: unparseable AI response');
    return [];
  }
}

/** Generates and stores today's ideas. Returns how many were stored (0 = already done today unless force). */
export async function runDailyPostIdeas(force = false): Promise<{ stored: number }> {
  const pool = await getPool();
  const today = todayUtc();

  if (!force) {
    const existing = await pool
      .request()
      .input('d', sql.Date, today)
      .query('SELECT TOP 1 1 AS x FROM dbo.ai_post_ideas WHERE idea_date = @d');
    if (existing.recordset.length > 0) {
      logger.info('Post ideas: today already generated — skipping');
      return { stored: 0 };
    }
  }

  const ideas = await generateIdeas();
  let stored = 0;
  for (const idea of ideas) {
    const caption = typeof idea.caption === 'string' ? idea.caption.trim().slice(0, 1000) : '';
    if (!caption) continue;
    const platform = ['facebook', 'instagram', 'linkedin'].includes(String(idea.platform))
      ? String(idea.platform)
      : 'facebook';
    await pool
      .request()
      .input('d', sql.Date, today)
      .input('platform', sql.NVarChar(20), platform)
      .input('caption', sql.NVarChar(1000), caption)
      .input('hashtags', sql.NVarChar(400), typeof idea.hashtags === 'string' ? idea.hashtags.slice(0, 400) : null)
      .input('brief', sql.NVarChar(1000), typeof idea.imageBrief === 'string' ? idea.imageBrief.slice(0, 1000) : null)
      .input('hook', sql.NVarChar(500), typeof idea.newsHook === 'string' && idea.newsHook.trim() ? idea.newsHook.slice(0, 500) : null)
      .query(`
        INSERT INTO dbo.ai_post_ideas (idea_date, platform, caption, hashtags, image_brief, news_hook)
        VALUES (@d, @platform, @caption, @hashtags, @brief, @hook)
      `);
    stored += 1;
  }

  logger.info('Post ideas: generated', { stored });
  return { stored };
}

export async function tryRunDailyPostIdeas(): Promise<void> {
  try {
    await runDailyPostIdeas(false);
  } catch (err) {
    logger.error('Post ideas job failed', { error: toErrorMessage(err) });
    throw err;
  }
}

export async function listRecentPostIdeas(days = 7): Promise<PostIdeaDTO[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('days', sql.Int, days)
    .query(`
      SELECT TOP (30) id, idea_date, platform, caption, hashtags, image_brief, news_hook
      FROM dbo.ai_post_ideas
      WHERE idea_date >= DATEADD(day, -@days, CAST(GETUTCDATE() AS DATE))
      ORDER BY idea_date DESC, id DESC
    `);
  return res.recordset.map((r: Record<string, unknown>) => ({
    id: Number(r.id),
    ideaDate: new Date(r.idea_date as Date).toISOString().slice(0, 10),
    platform: String(r.platform),
    caption: String(r.caption),
    hashtags: (r.hashtags as string) ?? null,
    imageBrief: (r.image_brief as string) ?? null,
    newsHook: (r.news_hook as string) ?? null,
  }));
}
