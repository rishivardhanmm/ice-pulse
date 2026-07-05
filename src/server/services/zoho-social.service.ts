import type {
  AiPostDraftDTO,
  AiSocialInsightDTO,
  ZohoSocialPostDTO,
  ZohoSocialProfileDTO,
  ZohoSocialSummaryDTO,
} from '@/lib/types';
import {
  getZohoPostsForCalendar,
  getZohoSocialSummary,
  listZohoPosts,
  listZohoProfiles,
  type PostListParams,
} from '@/server/db/repositories/zoho-social.repo';
import { runAi } from '@/ai/run';
import { isAiConfigured } from '@/server/config/env';
import { logger } from '@/server/logger';

function toPostDTO(row: Awaited<ReturnType<typeof listZohoPosts>>[number]): ZohoSocialPostDTO {
  let mediaUrls: string[] = [];
  try {
    if (row.mediaUrlsJson) mediaUrls = JSON.parse(row.mediaUrlsJson) as string[];
  } catch {
    // ignore parse failures
  }
  return {
    id: row.id,
    zohoPostId: row.zohoPostId,
    network: row.network,
    contentText: row.contentText,
    mediaUrls,
    postType: row.postType,
    permalinkUrl: row.permalinkUrl,
    publishedAt: row.publishedAt instanceof Date
      ? row.publishedAt.toISOString()
      : String(row.publishedAt),
    impressions: row.impressions,
    reach: row.reach,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    clicks: row.clicks,
    engagementRate: row.engagementRate != null ? Number(row.engagementRate) : null,
    profileName: row.profileName,
    clientId: row.clientId,
    clientName: row.clientName,
    brandName: row.brandName,
  };
}

export async function getSocialPosts(params: PostListParams = {}): Promise<ZohoSocialPostDTO[]> {
  const rows = await listZohoPosts({ limit: 200, ...params });
  return rows.map(toPostDTO);
}

export async function getSocialProfiles(): Promise<ZohoSocialProfileDTO[]> {
  return listZohoProfiles();
}

export async function getSocialSummary(days = 30): Promise<ZohoSocialSummaryDTO[]> {
  const rows = await getZohoSocialSummary(days);
  return rows.map((r) => ({
    network: r.network,
    postCount: r.postCount,
    totalImpressions: r.totalImpressions,
    totalReach: r.totalReach,
    totalLikes: r.totalLikes,
    totalComments: r.totalComments,
    totalShares: r.totalShares,
    avgEngagementRate: r.avgEngagementRate != null ? Number(r.avgEngagementRate) : null,
  }));
}

export async function getSocialCalendarEvents(from: string, to: string) {
  return getZohoPostsForCalendar(from, to);
}

export async function getAiSocialInsights(days = 90): Promise<AiSocialInsightDTO> {
  if (!isAiConfigured()) throw new Error('AI is not configured.');

  const posts = await listZohoPosts({ limit: 100 });
  if (posts.length === 0) {
    throw new Error('No posts synced yet — run a Zoho Social sync first to generate insights.');
  }

  const topN = [...posts]
    .sort((a, b) => (Number(b.engagementRate ?? 0)) - (Number(a.engagementRate ?? 0)))
    .slice(0, 20);

  const postSummaries = topN.map((p, i) => {
    const text = (p.contentText ?? '').slice(0, 150).replace(/\n/g, ' ');
    return `${i + 1}. [${p.network.toUpperCase()}] "${text}" — likes:${p.likes} comments:${p.comments} shares:${p.shares} impressions:${p.impressions} reach:${p.reach} engagement:${Number(p.engagementRate ?? 0).toFixed(2)}%`;
  }).join('\n');

  const result = await runAi(
    'zoho_social_insights',
    {
      system:
        'You are a social media performance analyst for ICE Creates, a creative marketing agency. ' +
        'Return ONLY valid JSON with no markdown fences.',
      messages: [
        {
          role: 'user',
          content:
            `Analyse the top ${topN.length} performing posts from the last ${days} days:\n\n` +
            postSummaries +
            '\n\nReturn a JSON object:\n' +
            '{"summary":"2-3 sentence summary","topPerformers":[{"network":"instagram","insight":"..."}],' +
            '"contentTips":["tip"],"timingTips":["tip"]}',
        },
      ],
      json: true,
      maxTokens: 800,
    },
  );

  type InsightShape = {
    summary?: string;
    topPerformers?: { network: string; insight: string }[];
    contentTips?: string[];
    timingTips?: string[];
  };

  let parsed: InsightShape = {};
  try {
    parsed = JSON.parse(result.text) as InsightShape;
  } catch {
    logger.warn('AI social insights returned non-JSON', { text: result.text.slice(0, 200) });
    return {
      summary: result.text.slice(0, 400),
      topPerformers: [],
      contentTips: [],
      timingTips: [],
      model: result.model,
      usage: { totalTokens: result.usage.totalTokens, estimatedCostUsd: result.estimatedCostUsd },
    };
  }

  return {
    summary: parsed.summary ?? '',
    topPerformers: parsed.topPerformers ?? [],
    contentTips: parsed.contentTips ?? [],
    timingTips: parsed.timingTips ?? [],
    model: result.model,
    usage: { totalTokens: result.usage.totalTokens, estimatedCostUsd: result.estimatedCostUsd },
  };
}

export async function generatePostDraft(params: {
  topic: string;
  networks: string[];
  tone?: string;
  includeNewsContext?: boolean;
}): Promise<AiPostDraftDTO> {
  if (!isAiConfigured()) throw new Error('AI is not configured.');

  const recentPosts = await listZohoPosts({ limit: 30 });

  const topPosts = [...recentPosts]
    .filter((p) => p.impressions > 0)
    .sort((a, b) => (Number(b.engagementRate ?? 0)) - (Number(a.engagementRate ?? 0)))
    .slice(0, 10);

  const performanceContext = topPosts.length
    ? `\nTop performing recent posts for style reference:\n` +
      topPosts
        .map(
          (p) =>
            `- [${p.network.toUpperCase()}] ${(p.contentText ?? '').slice(0, 100)} (${Number(p.engagementRate ?? 0).toFixed(2)}% engagement)`,
        )
        .join('\n')
    : '';

  const networksStr = params.networks.length ? params.networks.join(', ') : 'all networks';
  const toneStr = params.tone ?? 'professional but approachable';

  const result = await runAi(
    'zoho_social_post_draft',
    {
      system:
        'You are a social media copywriter for ICE Creates, a creative marketing agency in Australia. ' +
        'Return ONLY valid JSON with no markdown fences.',
      messages: [
        {
          role: 'user',
          content:
            `Create a social media post about: "${params.topic}"\n` +
            `Target networks: ${networksStr}\nTone: ${toneStr}\n` +
            performanceContext +
            '\n\nReturn JSON: {"caption":"...","hashtags":["tag1"],"bestNetworks":["instagram"],' +
            '"bestTimes":["Tuesday 10am-12pm AEST"],"rationale":"..."}',
        },
      ],
      json: true,
      maxTokens: 600,
    },
  );

  type DraftShape = {
    caption?: string;
    hashtags?: string[];
    bestNetworks?: string[];
    bestTimes?: string[];
    rationale?: string;
  };

  let parsed: DraftShape = {};
  try {
    parsed = JSON.parse(result.text) as DraftShape;
  } catch {
    return {
      caption: result.text.slice(0, 500),
      hashtags: [],
      bestNetworks: params.networks,
      bestTimes: [],
      rationale: 'AI draft generated from performance data.',
      model: result.model,
      usage: { totalTokens: result.usage.totalTokens, estimatedCostUsd: result.estimatedCostUsd },
    };
  }

  return {
    caption: parsed.caption ?? '',
    hashtags: parsed.hashtags ?? [],
    bestNetworks: parsed.bestNetworks ?? params.networks,
    bestTimes: parsed.bestTimes ?? [],
    rationale: parsed.rationale ?? '',
    model: result.model,
    usage: { totalTokens: result.usage.totalTokens, estimatedCostUsd: result.estimatedCostUsd },
  };
}
