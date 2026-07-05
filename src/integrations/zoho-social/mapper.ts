import type { ZohoBrandRaw, ZohoNetwork, ZohoPostRaw, ZohoPostType, ZohoProfileRaw } from './types';

/** Map Zoho channel string to our normalised network key. */
export function normaliseNetwork(channel: string): ZohoNetwork {
  const c = channel.toLowerCase();
  if (c.includes('instagram')) return 'instagram';
  if (c.includes('facebook')) return 'facebook';
  if (c.includes('linkedin')) return 'linkedin';
  if (c.includes('twitter') || c.includes('x.com')) return 'twitter';
  if (c.includes('youtube')) return 'youtube';
  if (c.includes('tiktok')) return 'tiktok';
  return 'facebook'; // fallback
}

/** Map Zoho post type string to our normalised post type. */
export function normalisePostType(type?: string): ZohoPostType {
  const t = (type ?? '').toLowerCase();
  if (t === 'image') return 'image';
  if (t === 'video') return 'video';
  if (t === 'link') return 'link';
  if (t === 'carousel') return 'carousel';
  if (t === 'reel') return 'reel';
  return 'text';
}

export function mapBrand(raw: ZohoBrandRaw) {
  return {
    zohoBrandId: raw.brand_id,
    name: raw.brand_name,
    logoUrl: raw.logo_url ?? null,
  };
}

export function mapProfile(raw: ZohoProfileRaw) {
  return {
    zohoProfileId: raw.profile_id,
    network: normaliseNetwork(raw.channel),
    profileName: raw.profile_name,
    profileUrl: raw.profile_url ?? null,
    followerCount: raw.follower_count != null ? Number(raw.follower_count) : null,
  };
}

export function mapPost(raw: ZohoPostRaw, profileId: number) {
  const network = normaliseNetwork(raw.network_type ?? '');
  const publishedAt = raw.publish_time
    ? new Date(raw.publish_time)
    : raw.schedule_time
      ? new Date(raw.schedule_time)
      : new Date();
  const mediaUrls: string[] = [];
  if (raw.media_url) {
    if (Array.isArray(raw.media_url)) mediaUrls.push(...raw.media_url);
    else mediaUrls.push(raw.media_url);
  }
  return {
    profileId,
    zohoPostId: raw.post_id,
    network,
    contentText: raw.message ?? null,
    mediaUrlsJson: mediaUrls.length ? JSON.stringify(mediaUrls) : null,
    postType: normalisePostType(raw.type),
    permalinkUrl: raw.permalink_url ?? null,
    publishedAt,
    rawPayloadJson: JSON.stringify(raw),
  };
}

export function mapScheduledPost(raw: ZohoPostRaw, profileId: number) {
  return {
    profileId,
    zohoPostId: raw.post_id,
    network: normaliseNetwork(raw.network_type ?? ''),
    contentText: raw.message ?? null,
    scheduledAt: raw.schedule_time ? new Date(raw.schedule_time) : new Date(),
    status: 'scheduled' as const,
  };
}
