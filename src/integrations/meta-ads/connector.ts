import type { ConnectionStatus, DataConnector, SyncOptions, SyncResult } from '../connector';
import { getAdAccountInfo, fetchInsights } from './client';
import { mapInsightRow } from './mapper';
import { friendlyMetaError } from './errors';
import { getMetaAdsConfig, isMetaAdsConfigured } from '../../server/config/env';
import { getDefaultClientId } from '../../server/db/repositories/clients.repo';
import { ensureMetaAdsAccount } from '../../server/db/repositories/platformAccounts.repo';
import { upsertMetaCampaign, upsertMetaDailyMetric } from '../../server/db/repositories/meta-metrics.repo';
import { startSyncRun, finishSyncRun } from '../../server/db/repositories/syncRuns.repo';
import { logger } from '../../server/logger';

const SOURCE = 'meta_ads';

export class MetaAdsConnector implements DataConnector {
  readonly name = 'Meta Ads';
  readonly source = SOURCE;

  async testConnection(): Promise<ConnectionStatus> {
    if (!isMetaAdsConfigured()) {
      return {
        ok: false,
        message: 'Meta Ads credentials are not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in .env.local.',
      };
    }
    try {
      const cfg = getMetaAdsConfig();
      const account = await getAdAccountInfo(cfg.apiVersion, cfg.adAccountId, cfg.accessToken);
      return {
        ok: true,
        message: `Connected to Meta Ads account "${account.name}".`,
        details: {
          accountId: account.id,
          accountName: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          status: account.account_status,
        },
      };
    } catch (err) {
      return { ok: false, message: friendlyMetaError(err) };
    }
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const triggeredBy = options.triggeredBy ?? 'cli';
    let syncRunId: number | null = null;
    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      const cfg = getMetaAdsConfig(); // throws if not configured

      syncRunId = await startSyncRun(SOURCE, {
        from: options.from,
        to: options.to,
        triggeredBy,
      });

      logger.info('Meta Ads sync started', {
        from: options.from,
        to: options.to,
        triggeredBy,
        syncRunId,
        adAccountId: cfg.adAccountId,
      });

      // Fetch account info for platform_account record
      const accountInfo = await getAdAccountInfo(cfg.apiVersion, cfg.adAccountId, cfg.accessToken);

      const clientId = await getDefaultClientId();
      const platformAccountId = await ensureMetaAdsAccount({
        clientId,
        adAccountId: cfg.adAccountId,
        accountName: accountInfo.name,
        currencyCode: accountInfo.currency,
        timezone: accountInfo.timezone_name,
      });

      // Fetch campaign-level daily insights
      const rows = await fetchInsights(
        cfg.apiVersion,
        cfg.adAccountId,
        options.from,
        options.to,
        cfg.accessToken,
      );

      logger.info('Meta Ads insight rows fetched', { count: rows.length });

      const campaignDbIdByMetaId = new Map<string, number>();

      for (const row of rows) {
        const mapped = mapInsightRow(row);
        if (!mapped) {
          skipped += 1;
          continue;
        }
        processed += 1;

        let campaignDbId = campaignDbIdByMetaId.get(mapped.campaignId);
        if (campaignDbId === undefined) {
          campaignDbId = await upsertMetaCampaign({
            platformAccountId,
            metaAccountId: cfg.adAccountId,
            metaCampaignId: mapped.campaignId,
            name: mapped.campaignName,
            status: null, // insights endpoint doesn't return status; connector can be extended later
            objective: null,
          });
          campaignDbIdByMetaId.set(mapped.campaignId, campaignDbId);
        }

        const action = await upsertMetaDailyMetric({
          campaignId: campaignDbId,
          metricDate: mapped.metricDate,
          impressions: mapped.impressions,
          clicks: mapped.clicks,
          reach: mapped.reach,
          spend: mapped.spend,
          conversions: mapped.conversions,
          conversionsValue: mapped.conversionsValue,
          ctr: mapped.ctr,
          cpc: mapped.cpc,
          costPerConversion: mapped.costPerConversion,
          rawPayloadJson: mapped.rawPayloadJson,
        });
        if (action === 'INSERT') inserted += 1;
        else updated += 1;
      }

      const finishedAt = new Date().toISOString();
      await finishSyncRun(syncRunId, {
        status: 'success',
        recordsProcessed: processed,
        recordsInserted: inserted,
        recordsUpdated: updated,
        metadata: { campaigns: campaignDbIdByMetaId.size, skipped },
      });

      logger.info('Meta Ads sync finished', {
        processed,
        inserted,
        updated,
        skipped,
        campaigns: campaignDbIdByMetaId.size,
      });

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
      const errorMessage = friendlyMetaError(err);
      const finishedAt = new Date().toISOString();
      logger.error('Meta Ads sync failed', { error: errorMessage, syncRunId });
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

export const metaAdsConnector = new MetaAdsConnector();
