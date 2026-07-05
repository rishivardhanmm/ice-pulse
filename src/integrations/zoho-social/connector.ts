import type { ConnectionStatus, DataConnector, SyncOptions, SyncResult } from '../connector';
import { isZohoSocialConfigured } from '@/server/config/env';
import {
  getLatestZohoConnection,
  listZohoBrands,
  upsertZohoBrand,
  upsertZohoPost,
  upsertZohoProfile,
  upsertZohoScheduledPost,
} from '@/server/db/repositories/zoho-social.repo';
import { startSyncRun, finishSyncRun } from '@/server/db/repositories/syncRuns.repo';
import { logger } from '@/server/logger';
import {
  fetchBrands,
  fetchPostAnalytics,
  fetchPublishedPosts,
  fetchScheduledPosts,
  fetchProfiles,
} from './apiClient';
import { mapBrand, mapPost, mapProfile, mapScheduledPost } from './mapper';
import { getValidAccessToken } from './tokenService';

const SOURCE = 'zoho_social';

export class ZohoSocialConnector implements DataConnector {
  readonly name = 'Zoho Social';
  readonly source = SOURCE;

  async testConnection(): Promise<ConnectionStatus> {
    if (!isZohoSocialConfigured()) {
      return {
        ok: false,
        message: 'Zoho Social credentials are not configured. Set ZOHO_SOCIAL_CLIENT_ID, ZOHO_SOCIAL_CLIENT_SECRET, and ZOHO_SOCIAL_ORG_ID in .env.local.',
      };
    }
    const conn = await getLatestZohoConnection();
    if (!conn || conn.status !== 'connected') {
      return {
        ok: false,
        message: 'Zoho Social is configured but not connected. Go to Social Posts and click Connect Zoho Social.',
      };
    }
    try {
      const accessToken = await getValidAccessToken(conn.id);
      const brands = await fetchBrands(accessToken);
      return {
        ok: true,
        message: `Connected to Zoho Social. Found ${brands.length} brand(s).`,
        details: { brands: brands.map((b) => b.brand_name) },
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Zoho Social connection test failed.',
      };
    }
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const triggeredBy = options.triggeredBy ?? 'api';
    let syncRunId: number | null = null;
    let processed = 0;
    let inserted = 0;
    let updated = 0;

    try {
      const conn = await getLatestZohoConnection();
      if (!conn || conn.status !== 'connected') {
        throw new Error('Zoho Social is not connected. Please authenticate via the Social Posts page.');
      }

      syncRunId = await startSyncRun(SOURCE, {
        from: options.from,
        to: options.to,
        triggeredBy,
      });

      const accessToken = await getValidAccessToken(conn.id);
      const brands = await fetchBrands(accessToken);

      for (const rawBrand of brands) {
        const brandMapped = mapBrand(rawBrand);
        const brandId = await upsertZohoBrand({ connectionId: conn.id, ...brandMapped });

        const rawProfiles = await fetchProfiles(accessToken, rawBrand.brand_id);
        for (const rawProfile of rawProfiles) {
          const profileMapped = mapProfile(rawProfile);
          await upsertZohoProfile({ brandId, ...profileMapped });
        }

        // Sync published posts
        const rawPosts = await fetchPublishedPosts(
          accessToken,
          rawBrand.brand_id,
          options.from,
          options.to,
        );

        for (const rawPost of rawPosts) {
          const profile = rawProfiles.find(
            (p) => p.profile_id === rawPost.network_type,
          ) ?? rawProfiles[0];
          if (!profile) continue;

          const profileBrands = await listZohoBrands(conn.id);
          const dbBrand = profileBrands.find((b) => b.zohoBrandId === rawBrand.brand_id);
          if (!dbBrand) continue;

          // Get profile DB id by zoho_profile_id
          const { listZohoProfiles } = await import('@/server/db/repositories/zoho-social.repo');
          const dbProfiles = await listZohoProfiles(dbBrand.id);
          const dbProfile = dbProfiles.find((p) => p.zohoProfileId === profile.profile_id);
          if (!dbProfile) continue;

          let analytics: Partial<{ impressions: number; reach: number; likes: number; comments: number; shares: number; clicks: number }> = {};
          try {
            const raw = await fetchPostAnalytics(accessToken, rawBrand.brand_id, rawPost.post_id);
            analytics = {
              impressions: raw.impressions != null ? Number(raw.impressions) : 0,
              reach: raw.reach != null ? Number(raw.reach) : 0,
              likes: raw.likes != null ? Number(raw.likes) : 0,
              comments: raw.comments != null ? Number(raw.comments) : 0,
              shares: raw.shares != null ? Number(raw.shares) : 0,
              clicks: raw.clicks != null ? Number(raw.clicks) : 0,
            };
          } catch {
            // analytics are best-effort
          }

          processed += 1;
          const postMapped = mapPost(rawPost, dbProfile.id);
          const action = await upsertZohoPost({ ...postMapped, ...analytics });
          if (action === 'INSERT') inserted += 1;
          else updated += 1;
        }

        // Sync scheduled posts for Campaign Calendar
        const rawScheduled = await fetchScheduledPosts(accessToken, rawBrand.brand_id);
        for (const rawPost of rawScheduled) {
          const profile = rawProfiles[0];
          if (!profile) continue;
          const profileBrands = await listZohoBrands(conn.id);
          const dbBrand2 = profileBrands.find((b) => b.zohoBrandId === rawBrand.brand_id);
          if (!dbBrand2) continue;
          const { listZohoProfiles: listP } = await import('@/server/db/repositories/zoho-social.repo');
          const dbProfiles2 = await listP(dbBrand2.id);
          const dbProfile2 = dbProfiles2.find((p) => p.zohoProfileId === profile.profile_id);
          if (!dbProfile2) continue;
          const sched = mapScheduledPost(rawPost, dbProfile2.id);
          await upsertZohoScheduledPost(sched);
        }
      }

      const finishedAt = new Date().toISOString();
      await finishSyncRun(syncRunId, {
        status: 'success',
        recordsProcessed: processed,
        recordsInserted: inserted,
        recordsUpdated: updated,
        metadata: { brands: brands.length },
      });

      logger.info('Zoho Social sync finished', { processed, inserted, updated });

      return {
        source: SOURCE,
        status: 'success',
        startedAt,
        finishedAt,
        recordsProcessed: processed,
        recordsInserted: inserted,
        recordsUpdated: updated,
        errorMessage: null,
        syncRunId,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const finishedAt = new Date().toISOString();
      logger.error('Zoho Social sync failed', { error: errorMessage });
      if (syncRunId !== null) {
        await finishSyncRun(syncRunId, {
          status: 'failed',
          recordsProcessed: processed,
          recordsInserted: inserted,
          recordsUpdated: updated,
          errorMessage,
        }).catch(() => undefined);
      }
      return {
        source: SOURCE,
        status: 'failed',
        startedAt,
        finishedAt,
        recordsProcessed: processed,
        recordsInserted: inserted,
        recordsUpdated: updated,
        errorMessage,
        syncRunId,
      };
    }
  }
}

export const zohoSocialConnector = new ZohoSocialConnector();
