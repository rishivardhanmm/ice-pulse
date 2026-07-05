/** Zoho Social API response and internal types. */

export type ZohoNetwork = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'gmb';
export type ZohoPostType = 'image' | 'video' | 'text' | 'link' | 'carousel' | 'reel';
export type ZohoPostStatus = 'published' | 'scheduled' | 'failed' | 'draft' | 'cancelled';

export interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  api_domain?: string;
}

export interface ZohoBrandRaw {
  zpk?: string;
  portal_id?: string;
  brand_id: string;
  brand_name: string;
  logo_url?: string;
}

export interface ZohoProfileRaw {
  profile_id: string;
  profile_name: string;
  channel: string;          // Zoho's channel name, e.g. 'Facebook', 'Instagram'
  profile_url?: string;
  follower_count?: number | string;
}

export interface ZohoPostRaw {
  post_id: string;
  message?: string;
  type?: string;             // 'IMAGE' | 'VIDEO' | 'TEXT' | 'LINK' | 'CAROUSEL' | 'REEL'
  network_type?: string;     // 'Facebook' | 'Instagram' | ...
  permalink_url?: string;
  schedule_time?: string;    // ISO string
  publish_time?: string;     // ISO string
  media_url?: string | string[];
  status?: string;
}

export interface ZohoPostAnalyticsRaw {
  post_id?: string;
  impressions?: number | string;
  reach?: number | string;
  likes?: number | string;
  comments?: number | string;
  shares?: number | string;
  clicks?: number | string;
}

export interface ZohoConnectionRecord {
  id: number;
  orgId: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenEncVersion: string;
  expiresAt: Date | null;
  scopes: string | null;
  status: 'connected' | 'expired' | 'disconnected';
  connectedBy: number;
  connectedAt: Date;
  lastRefreshedAt: Date | null;
}

export interface ZohoBrandRecord {
  id: number;
  connectionId: number;
  zohoBrandId: string;
  name: string;
  logoUrl: string | null;
  clientId: number | null;
  syncedAt: Date;
}

export interface ZohoProfileRecord {
  id: number;
  brandId: number;
  zohoProfileId: string;
  network: string;
  profileName: string;
  profileUrl: string | null;
  followerCount: number | null;
  syncedAt: Date;
}
