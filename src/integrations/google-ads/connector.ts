import type {
  ConnectionStatus,
  DataConnector,
  SyncOptions,
  SyncResult,
} from '../connector';
import { createGoogleAdsCustomer } from './client';
import { buildCampaignMetricsQuery, CONNECTION_TEST_QUERY } from './query';
import { mapResultRow, type GoogleAdsResultRow } from './mapper';
import { serviceAccountQuery } from './service-account';
import { friendlyGoogleAdsError } from './errors';
import {
  getGoogleAdsAuthMode,
  getGoogleAdsConfig,
  getGoogleAdsServiceAccountConfig,
} from '../../server/config/env';
import { getDefaultClientId } from '../../server/db/repositories/clients.repo';
import { ensureGoogleAdsAccount } from '../../server/db/repositories/platformAccounts.repo';
import { upsertCampaign } from '../../server/db/repositories/campaigns.repo';
import { upsertDailyMetric } from '../../server/db/repositories/metrics.repo';
import {
  finishSyncRun,
  startSyncRun,
} from '../../server/db/repositories/syncRuns.repo';
import { logger } from '../../server/logger';

const SOURCE = 'google_ads';

export class GoogleAdsConnector implements DataConnector {
  readonly name = 'Google Ads';
  readonly source = SOURCE;

  /** Validates configuration for the active auth mode (throws if incomplete). */
  private assertConfigured(): void {
    if (getGoogleAdsAuthMode() === 'service_account') getGoogleAdsServiceAccountConfig();
    else getGoogleAdsConfig();
  }

  /** The configured customer id for the active auth mode. */
  private configuredCustomerId(): string {
    return getGoogleAdsAuthMode() === 'service_account'
      ? getGoogleAdsServiceAccountConfig().customerId
      : getGoogleAdsConfig().customerId;
  }

  /** Runs a GAQL query using the active auth mode; returns mapper-ready rows. */
  private async fetchRows(gaql: string): Promise<GoogleAdsResultRow[]> {
    if (getGoogleAdsAuthMode() === 'service_account') {
      return serviceAccountQuery(gaql);
    }
    const customer = createGoogleAdsCustomer();
    return (await customer.query(gaql)) as unknown as GoogleAdsResultRow[];
  }

  async testConnection(): Promise<ConnectionStatus> {
    try {
      const rows = await this.fetchRows(CONNECTION_TEST_QUERY);
      const first = rows[0];
      return {
        ok: true,
        message: 'Connected to Google Ads.',
        details: {
          authMode: getGoogleAdsAuthMode(),
          account: first?.customer?.descriptive_name ?? null,
          currency: first?.customer?.currency_code ?? null,
        },
      };
    } catch (err) {
      return { ok: false, message: friendlyGoogleAdsError(err) };
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
      this.assertConfigured(); // validate before recording a run
      syncRunId = await startSyncRun(SOURCE, {
        from: options.from,
        to: options.to,
        triggeredBy,
      });
      logger.info('Google Ads sync started', {
        from: options.from,
        to: options.to,
        triggeredBy,
        syncRunId,
      });

      const gaql = buildCampaignMetricsQuery(options.from, options.to);
      const rows = await this.fetchRows(gaql);

      const clientId = await getDefaultClientId();
      let platformAccountId: number | null = null;
      const campaignDbIdByGoogleId = new Map<string, number>();

      for (const row of rows) {
        const mapped = mapResultRow(row);
        if (!mapped) {
          skipped += 1;
          continue;
        }
        processed += 1;

        if (platformAccountId === null) {
          platformAccountId = await ensureGoogleAdsAccount({
            clientId,
            customerId: mapped.customerId || this.configuredCustomerId(),
            accountName: mapped.customerName,
            currencyCode: mapped.currencyCode,
            timezone: mapped.timezone,
          });
        }

        let campaignDbId = campaignDbIdByGoogleId.get(mapped.campaign.id);
        if (campaignDbId === undefined) {
          const result = await upsertCampaign({
            platformAccountId,
            googleCustomerId: mapped.customerId,
            googleCampaignId: mapped.campaign.id,
            name: mapped.campaign.name,
            status: mapped.campaign.status,
            channelType: mapped.campaign.channelType,
            startDate: mapped.campaign.startDate,
            endDate: mapped.campaign.endDate,
          });
          campaignDbId = result.id;
          campaignDbIdByGoogleId.set(mapped.campaign.id, campaignDbId);
        }

        const action = await upsertDailyMetric({
          campaignId: campaignDbId,
          metricDate: mapped.metricDate,
          ...mapped.metrics,
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
        metadata: { campaigns: campaignDbIdByGoogleId.size, skipped },
      });
      logger.info('Google Ads sync finished', {
        processed,
        inserted,
        updated,
        skipped,
        campaigns: campaignDbIdByGoogleId.size,
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
      const errorMessage = friendlyGoogleAdsError(err);
      const finishedAt = new Date().toISOString();
      logger.error('Google Ads sync failed', { error: errorMessage, syncRunId });
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

/** Shared instance for app + scripts. */
export const googleAdsConnector = new GoogleAdsConnector();
