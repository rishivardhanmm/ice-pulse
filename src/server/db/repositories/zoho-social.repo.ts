import { getPool } from '../pool';
import type { ZohoConnectionRecord } from '@/integrations/zoho-social/types';

// ── Connection / token management ─────────────────────────────────────

export async function createZohoConnection(params: {
  orgId: string;
  connectedBy: number;
}): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('orgId', params.orgId)
    .input('connectedBy', params.connectedBy)
    .query<{ id: number }>(`
      INSERT INTO dbo.zoho_social_connections (org_id, access_token_encrypted, token_enc_version, connected_by)
      VALUES (@orgId, '', 'plain', @connectedBy);
      SELECT SCOPE_IDENTITY() AS id;
    `);
  return result.recordset[0].id;
}

export async function upsertZohoToken(params: {
  connectionId: number;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenEncVersion: string;
  expiresAt: Date | null;
  scopes: string | null;
}): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('connectionId', params.connectionId)
    .input('accessTokenEncrypted', params.accessTokenEncrypted)
    .input('refreshTokenEncrypted', params.refreshTokenEncrypted)
    .input('tokenEncVersion', params.tokenEncVersion)
    .input('expiresAt', params.expiresAt)
    .input('scopes', params.scopes)
    .query(`
      UPDATE dbo.zoho_social_connections SET
        access_token_encrypted  = @accessTokenEncrypted,
        refresh_token_encrypted = @refreshTokenEncrypted,
        token_enc_version       = @tokenEncVersion,
        expires_at              = @expiresAt,
        scopes                  = @scopes,
        status                  = 'connected',
        last_refreshed_at       = SYSUTCDATETIME()
      WHERE id = @connectionId;
    `);
}

export async function getZohoConnection(connectionId: number): Promise<ZohoConnectionRecord | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', connectionId)
    .query<{
      id: number; orgId: string; accessTokenEncrypted: string; refreshTokenEncrypted: string | null;
      tokenEncVersion: string; expiresAt: Date | null; scopes: string | null; status: string;
      connectedBy: number; connectedAt: Date; lastRefreshedAt: Date | null;
    }>(`
      SELECT id, org_id AS orgId, access_token_encrypted AS accessTokenEncrypted,
             refresh_token_encrypted AS refreshTokenEncrypted, token_enc_version AS tokenEncVersion,
             expires_at AS expiresAt, scopes, status, connected_by AS connectedBy,
             connected_at AS connectedAt, last_refreshed_at AS lastRefreshedAt
      FROM dbo.zoho_social_connections WHERE id = @id;
    `);
  return (result.recordset[0] as ZohoConnectionRecord) ?? null;
}

export async function getLatestZohoConnection(): Promise<ZohoConnectionRecord | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query<{
      id: number; orgId: string; accessTokenEncrypted: string; refreshTokenEncrypted: string | null;
      tokenEncVersion: string; expiresAt: Date | null; scopes: string | null; status: string;
      connectedBy: number; connectedAt: Date; lastRefreshedAt: Date | null;
    }>(`
      SELECT TOP 1 id, org_id AS orgId, access_token_encrypted AS accessTokenEncrypted,
             refresh_token_encrypted AS refreshTokenEncrypted, token_enc_version AS tokenEncVersion,
             expires_at AS expiresAt, scopes, status, connected_by AS connectedBy,
             connected_at AS connectedAt, last_refreshed_at AS lastRefreshedAt
      FROM dbo.zoho_social_connections
      WHERE status != 'disconnected'
      ORDER BY connected_at DESC;
    `);
  return (result.recordset[0] as ZohoConnectionRecord) ?? null;
}

export async function setZohoConnectionStatus(
  connectionId: number,
  status: 'connected' | 'expired' | 'disconnected',
  touchRefreshed = false,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', connectionId)
    .input('status', status)
    .query(`
      UPDATE dbo.zoho_social_connections SET
        status = @status
        ${touchRefreshed ? ', last_refreshed_at = SYSUTCDATETIME()' : ''}
      WHERE id = @id;
    `);
}

export async function deleteZohoTokens(connectionId: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', connectionId)
    .query(`
      UPDATE dbo.zoho_social_connections SET
        access_token_encrypted = '', refresh_token_encrypted = NULL
      WHERE id = @id;
    `);
}

// ── Brands ────────────────────────────────────────────────────────────

export async function upsertZohoBrand(params: {
  connectionId: number;
  zohoBrandId: string;
  name: string;
  logoUrl: string | null;
  clientId?: number | null;
}): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('connectionId', params.connectionId)
    .input('zohoBrandId', params.zohoBrandId)
    .input('name', params.name)
    .input('logoUrl', params.logoUrl)
    .input('clientId', params.clientId ?? null)
    .query<{ id: number }>(`
      MERGE dbo.zoho_social_brands AS tgt
      USING (SELECT @connectionId AS connection_id, @zohoBrandId AS zoho_brand_id) AS src
        ON tgt.connection_id = src.connection_id AND tgt.zoho_brand_id = src.zoho_brand_id
      WHEN MATCHED THEN UPDATE SET
        name = @name, logo_url = @logoUrl, synced_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (connection_id, zoho_brand_id, name, logo_url, client_id)
        VALUES (@connectionId, @zohoBrandId, @name, @logoUrl, @clientId);
      SELECT id FROM dbo.zoho_social_brands WHERE connection_id = @connectionId AND zoho_brand_id = @zohoBrandId;
    `);
  return result.recordset[0].id;
}

export async function listZohoBrands(connectionId: number) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('connectionId', connectionId)
    .query<{ id: number; zohoBrandId: string; name: string; logoUrl: string | null; clientId: number | null }>(
      `SELECT id, zoho_brand_id AS zohoBrandId, name, logo_url AS logoUrl, client_id AS clientId
       FROM dbo.zoho_social_brands WHERE connection_id = @connectionId;`,
    );
  return result.recordset;
}

// ── Profiles ──────────────────────────────────────────────────────────

export async function upsertZohoProfile(params: {
  brandId: number;
  zohoProfileId: string;
  network: string;
  profileName: string;
  profileUrl: string | null;
  followerCount: number | null;
}): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('brandId', params.brandId)
    .input('zohoProfileId', params.zohoProfileId)
    .input('network', params.network)
    .input('profileName', params.profileName)
    .input('profileUrl', params.profileUrl)
    .input('followerCount', params.followerCount)
    .query<{ id: number }>(`
      MERGE dbo.zoho_social_profiles AS tgt
      USING (SELECT @brandId AS brand_id, @zohoProfileId AS zoho_profile_id) AS src
        ON tgt.brand_id = src.brand_id AND tgt.zoho_profile_id = src.zoho_profile_id
      WHEN MATCHED THEN UPDATE SET
        network = @network, profile_name = @profileName, profile_url = @profileUrl,
        follower_count = @followerCount, synced_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (brand_id, zoho_profile_id, network, profile_name, profile_url, follower_count)
        VALUES (@brandId, @zohoProfileId, @network, @profileName, @profileUrl, @followerCount);
      SELECT id FROM dbo.zoho_social_profiles WHERE brand_id = @brandId AND zoho_profile_id = @zohoProfileId;
    `);
  return result.recordset[0].id;
}

export async function listZohoProfiles(brandId?: number) {
  const pool = await getPool();
  const req = pool.request();
  const where = brandId != null ? 'WHERE p.brand_id = @brandId' : '';
  if (brandId != null) req.input('brandId', brandId);
  const result = await req.query<{
    id: number; brandId: number; zohoProfileId: string; network: string;
    profileName: string; followerCount: number | null; clientId: number | null;
    clientName: string | null; zohoBrandId: string; brandName: string;
  }>(`
    SELECT p.id, p.brand_id AS brandId, p.zoho_profile_id AS zohoProfileId,
           p.network, p.profile_name AS profileName, p.follower_count AS followerCount,
           b.client_id AS clientId, c.name AS clientName, b.zoho_brand_id AS zohoBrandId,
           b.name AS brandName
    FROM dbo.zoho_social_profiles p
    JOIN dbo.zoho_social_brands b ON b.id = p.brand_id
    LEFT JOIN dbo.clients c ON c.id = b.client_id
    ${where}
    ORDER BY b.name, p.network, p.profile_name;
  `);
  return result.recordset;
}

// ── Posts ─────────────────────────────────────────────────────────────

export async function upsertZohoPost(params: {
  profileId: number;
  zohoPostId: string;
  network: string;
  contentText: string | null;
  mediaUrlsJson: string | null;
  postType: string;
  permalinkUrl: string | null;
  publishedAt: Date;
  impressions?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  rawPayloadJson?: string | null;
}): Promise<'INSERT' | 'UPDATE'> {
  const pool = await getPool();
  const engage = (params.likes ?? 0) + (params.comments ?? 0) + (params.shares ?? 0);
  const engagementRate =
    params.reach && params.reach > 0 ? (engage / params.reach) * 100 : null;

  const result = await pool
    .request()
    .input('profileId', params.profileId)
    .input('zohoPostId', params.zohoPostId)
    .input('network', params.network)
    .input('contentText', params.contentText)
    .input('mediaUrlsJson', params.mediaUrlsJson)
    .input('postType', params.postType)
    .input('permalinkUrl', params.permalinkUrl)
    .input('publishedAt', params.publishedAt)
    .input('impressions', params.impressions ?? 0)
    .input('reach', params.reach ?? 0)
    .input('likes', params.likes ?? 0)
    .input('comments', params.comments ?? 0)
    .input('shares', params.shares ?? 0)
    .input('clicks', params.clicks ?? 0)
    .input('engagementRate', engagementRate)
    .input('rawPayloadJson', params.rawPayloadJson ?? null)
    .query<{ action: string }>(`
      MERGE dbo.zoho_social_posts AS tgt
      USING (SELECT @zohoPostId AS zoho_post_id) AS src
        ON tgt.zoho_post_id = src.zoho_post_id
      WHEN MATCHED THEN UPDATE SET
        impressions = @impressions, reach = @reach, likes = @likes, comments = @comments,
        shares = @shares, clicks = @clicks, engagement_rate = @engagementRate,
        raw_payload_json = @rawPayloadJson, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (
        profile_id, zoho_post_id, network, content_text, media_urls_json,
        post_type, permalink_url, published_at, impressions, reach, likes,
        comments, shares, clicks, engagement_rate, raw_payload_json
      ) VALUES (
        @profileId, @zohoPostId, @network, @contentText, @mediaUrlsJson,
        @postType, @permalinkUrl, @publishedAt, @impressions, @reach, @likes,
        @comments, @shares, @clicks, @engagementRate, @rawPayloadJson
      );
      SELECT CASE WHEN EXISTS(SELECT 1 FROM dbo.zoho_social_posts WHERE zoho_post_id = @zohoPostId AND created_at < updated_at)
             THEN 'UPDATE' ELSE 'INSERT' END AS action;
    `);
  return (result.recordset[0]?.action ?? 'INSERT') as 'INSERT' | 'UPDATE';
}

export async function upsertZohoScheduledPost(params: {
  profileId: number;
  zohoPostId: string;
  network: string;
  contentText: string | null;
  scheduledAt: Date;
  status: string;
}): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('profileId', params.profileId)
    .input('zohoPostId', params.zohoPostId)
    .input('network', params.network)
    .input('contentText', params.contentText)
    .input('scheduledAt', params.scheduledAt)
    .input('status', params.status)
    .query(`
      MERGE dbo.zoho_scheduled_posts AS tgt
      USING (SELECT @zohoPostId AS zoho_post_id) AS src
        ON tgt.zoho_post_id = src.zoho_post_id
      WHEN MATCHED THEN UPDATE SET
        status = @status, scheduled_at = @scheduledAt, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (profile_id, zoho_post_id, network, content_text, scheduled_at, status)
        VALUES (@profileId, @zohoPostId, @network, @contentText, @scheduledAt, @status);
    `);
}

export interface PostListParams {
  profileId?: number;
  network?: string;
  clientId?: number;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listZohoPosts(params: PostListParams = {}) {
  const pool = await getPool();
  const req = pool.request();
  const conditions: string[] = [];
  if (params.profileId != null) {
    req.input('profileId', params.profileId);
    conditions.push('zp.profile_id = @profileId');
  }
  if (params.network) {
    req.input('network', params.network);
    conditions.push('zp.network = @network');
  }
  if (params.clientId != null) {
    req.input('clientId', params.clientId);
    conditions.push('b.client_id = @clientId');
  }
  if (params.from) {
    req.input('from', new Date(params.from));
    conditions.push('zp.published_at >= @from');
  }
  if (params.to) {
    req.input('to', new Date(params.to));
    conditions.push('zp.published_at <= @to');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const top = params.limit ?? 100;
  const result = await req.query<{
    id: number; zohoPostId: string; network: string; contentText: string | null;
    mediaUrlsJson: string | null; postType: string; permalinkUrl: string | null;
    publishedAt: Date; impressions: number; reach: number; likes: number;
    comments: number; shares: number; clicks: number; engagementRate: number | null;
    profileName: string; clientId: number | null; clientName: string | null;
    brandName: string;
  }>(`
    SELECT TOP ${top}
      zp.id, zp.zoho_post_id AS zohoPostId, zp.network, zp.content_text AS contentText,
      zp.media_urls_json AS mediaUrlsJson, zp.post_type AS postType,
      zp.permalink_url AS permalinkUrl, zp.published_at AS publishedAt,
      zp.impressions, zp.reach, zp.likes, zp.comments, zp.shares, zp.clicks,
      zp.engagement_rate AS engagementRate,
      prof.profile_name AS profileName,
      b.client_id AS clientId, c.name AS clientName, b.name AS brandName
    FROM dbo.zoho_social_posts zp
    JOIN dbo.zoho_social_profiles prof ON prof.id = zp.profile_id
    JOIN dbo.zoho_social_brands b ON b.id = prof.brand_id
    LEFT JOIN dbo.clients c ON c.id = b.client_id
    ${where}
    ORDER BY zp.published_at DESC;
  `);
  return result.recordset;
}

export async function getZohoPostsForCalendar(from: string, to: string) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('from', new Date(from))
    .input('to', new Date(to))
    .query<{
      id: number; zohoPostId: string; network: string; contentText: string | null;
      scheduledAt: Date; status: string; profileName: string; clientId: number | null;
      clientName: string | null; brandName: string;
    }>(`
      SELECT zs.id, zs.zoho_post_id AS zohoPostId, zs.network,
             zs.content_text AS contentText, zs.scheduled_at AS scheduledAt,
             zs.status, prof.profile_name AS profileName,
             b.client_id AS clientId, c.name AS clientName, b.name AS brandName
      FROM dbo.zoho_scheduled_posts zs
      JOIN dbo.zoho_social_profiles prof ON prof.id = zs.profile_id
      JOIN dbo.zoho_social_brands b ON b.id = prof.brand_id
      LEFT JOIN dbo.clients c ON c.id = b.client_id
      WHERE zs.scheduled_at BETWEEN @from AND @to
      ORDER BY zs.scheduled_at;
    `);
  return result.recordset;
}

export async function getZohoSocialSummary(days = 30) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('since', new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    .query<{
      network: string; postCount: number; totalImpressions: number; totalReach: number;
      totalLikes: number; totalComments: number; totalShares: number; avgEngagementRate: number | null;
    }>(`
      SELECT zp.network,
             COUNT(*) AS postCount,
             SUM(zp.impressions) AS totalImpressions,
             SUM(zp.reach) AS totalReach,
             SUM(zp.likes) AS totalLikes,
             SUM(zp.comments) AS totalComments,
             SUM(zp.shares) AS totalShares,
             AVG(zp.engagement_rate) AS avgEngagementRate
      FROM dbo.zoho_social_posts zp
      WHERE zp.published_at >= @since
      GROUP BY zp.network
      ORDER BY totalImpressions DESC;
    `);
  return result.recordset;
}
