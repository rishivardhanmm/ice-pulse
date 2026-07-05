import { getZohoSocialConfig } from '@/server/config/env';
import type { ZohoBrandRaw, ZohoPostAnalyticsRaw, ZohoPostRaw, ZohoProfileRaw } from './types';

/**
 * Low-level Zoho Social REST API client.
 * All requests are authenticated with a Bearer access token obtained via OAuth.
 */

async function zohoFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit,
): Promise<T> {
  const cfg = getZohoSocialConfig();
  const url = `${cfg.apiBaseUrl}/${cfg.orgId}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Zoho Social API error ${res.status} for ${path}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/** Retrieve all brands in the org. */
export async function fetchBrands(accessToken: string): Promise<ZohoBrandRaw[]> {
  const data = await zohoFetch<{ brands?: ZohoBrandRaw[] }>('/brands', accessToken);
  return data.brands ?? [];
}

/** Retrieve all social profiles for a brand. */
export async function fetchProfiles(
  accessToken: string,
  brandId: string,
): Promise<ZohoProfileRaw[]> {
  const data = await zohoFetch<{ profiles?: ZohoProfileRaw[] }>(
    `/brands/${brandId}/profiles`,
    accessToken,
  );
  return data.profiles ?? [];
}

/** Retrieve published posts for a brand, optionally filtered by date. */
export async function fetchPublishedPosts(
  accessToken: string,
  brandId: string,
  fromDate?: string,
  toDate?: string,
): Promise<ZohoPostRaw[]> {
  const params = new URLSearchParams({ type: 'published' });
  if (fromDate) params.set('from_date', fromDate);
  if (toDate) params.set('to_date', toDate);
  const data = await zohoFetch<{ posts?: ZohoPostRaw[] }>(
    `/brands/${brandId}/posts?${params}`,
    accessToken,
  );
  return data.posts ?? [];
}

/** Retrieve scheduled / draft posts for a brand. */
export async function fetchScheduledPosts(
  accessToken: string,
  brandId: string,
): Promise<ZohoPostRaw[]> {
  const data = await zohoFetch<{ posts?: ZohoPostRaw[] }>(
    `/brands/${brandId}/posts?type=scheduled`,
    accessToken,
  );
  return data.posts ?? [];
}

/** Retrieve per-post analytics. */
export async function fetchPostAnalytics(
  accessToken: string,
  brandId: string,
  postId: string,
): Promise<ZohoPostAnalyticsRaw> {
  const data = await zohoFetch<{ analytics?: ZohoPostAnalyticsRaw }>(
    `/brands/${brandId}/posts/${postId}/analytics`,
    accessToken,
  );
  return data.analytics ?? {};
}

export interface ZohoCreatePostParams {
  brandId: string;
  profileIds: string[];  // network profile IDs to post to
  message: string;
  scheduledTime?: string;  // ISO string — if set, schedules; otherwise publishes immediately
  mediaUrls?: string[];
}

/** Create or schedule a post via Zoho Social API. Returns the new post_id. */
export async function createPost(
  accessToken: string,
  params: ZohoCreatePostParams,
): Promise<string> {
  const body: Record<string, unknown> = {
    profile_ids: params.profileIds,
    message: params.message,
  };
  if (params.scheduledTime) {
    body.schedule_time = params.scheduledTime;
    body.type = 'schedule';
  } else {
    body.type = 'immediate';
  }
  if (params.mediaUrls?.length) {
    body.media_urls = params.mediaUrls;
  }

  const data = await zohoFetch<{ post_id?: string }>(
    `/brands/${params.brandId}/posts`,
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
  );
  if (!data.post_id) throw new Error('Zoho createPost did not return a post_id');
  return data.post_id;
}
