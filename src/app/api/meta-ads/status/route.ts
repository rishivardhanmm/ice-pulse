import { metaAdsConnector } from '@/integrations/meta-ads/connector';
import { isMetaAdsConfigured } from '@/server/config/env';
import { getLastSyncRun } from '@/server/db/repositories/syncRuns.repo';
import { jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import type { ConnectionStatusDTO } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = isMetaAdsConfigured();

  const [lastSuccess, lastFailure] = await Promise.all([
    getLastSyncRun('meta_ads', 'success').catch(() => null),
    getLastSyncRun('meta_ads', 'failed').catch(() => null),
  ]);

  let message: string;
  if (!configured) {
    message = 'Meta Ads credentials are not configured. Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to .env.local.';
  } else if (lastSuccess) {
    message = 'Connected. Campaign data is synced from Meta Ads into MSSQL.';
  } else {
    message = 'Credentials detected. Run a sync to pull data from Meta Ads.';
  }

  const status: ConnectionStatusDTO = {
    source: 'meta_ads',
    configured,
    connected: configured && Boolean(lastSuccess),
    message,
    lastSuccessAt: lastSuccess?.finishedAt ?? null,
    lastFailureAt: lastFailure?.finishedAt ?? null,
  };

  // If configured, do a live connection test
  if (configured) {
    try {
      const test = await metaAdsConnector.testConnection();
      status.connected = test.ok;
      if (!test.ok) status.message = test.message;
    } catch (err) {
      status.connected = false;
      status.message = toErrorMessage(err);
    }
  }

  return jsonOk(status);
}
