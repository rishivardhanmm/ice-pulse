import { googleAdsConnector } from '../../integrations/google-ads/connector';
import { metaAdsConnector } from '../../integrations/meta-ads/connector';
import { isGoogleAdsConfigured, isMetaAdsConfigured } from '../config/env';
import { listSchedules, markRun } from '../db/repositories/syncSchedules.repo';
import { logger, toErrorMessage } from '../logger';
import type { DataConnector } from '../../integrations/connector';

const TICK_MS = 60_000;

interface SourceEntry {
  connector: DataConnector;
  isConfigured: () => boolean;
}

/** Registry of syncable sources. Add a row here (+ a sync_schedules row) to wire up a new source. */
const SOURCE_REGISTRY: Record<string, SourceEntry> = {
  google_ads: { connector: googleAdsConnector, isConfigured: isGoogleAdsConfigured },
  meta_ads: { connector: metaAdsConnector, isConfigured: isMetaAdsConfigured },
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Checks every scheduled source and runs any that are due. Safe to call repeatedly. */
export async function runDueSyncs(): Promise<void> {
  let schedules;
  try {
    schedules = await listSchedules();
  } catch (err) {
    logger.error('Scheduler: failed to read sync_schedules', { error: toErrorMessage(err) });
    return;
  }

  for (const schedule of schedules) {
    const entry = SOURCE_REGISTRY[schedule.source];
    if (!entry) continue;
    if (!schedule.enabled) continue;
    if (!entry.isConfigured()) continue;

    const dueAt = schedule.lastRunAt
      ? new Date(schedule.lastRunAt).getTime() + schedule.intervalMinutes * 60_000
      : 0;
    if (Date.now() < dueAt) continue;

    const to = todayUtc();
    const from = shiftDays(to, -schedule.lookbackDays);

    logger.info('Scheduler: running due sync', { source: schedule.source, from, to });
    try {
      const result = await entry.connector.sync({ from, to, triggeredBy: 'schedule' });
      await markRun(schedule.source, result.status === 'success' ? 'success' : 'failed');
    } catch (err) {
      logger.error('Scheduler: sync threw', { source: schedule.source, error: toErrorMessage(err) });
      await markRun(schedule.source, 'failed').catch(() => undefined);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __icePulseSchedulerStarted: boolean | undefined;
}

/** Starts the in-process scheduler loop. Idempotent — safe to call more than once. */
export function startScheduler(): void {
  if (globalThis.__icePulseSchedulerStarted) return;
  globalThis.__icePulseSchedulerStarted = true;

  logger.info('Scheduler: starting', { tickMs: TICK_MS });
  setInterval(() => {
    void runDueSyncs();
  }, TICK_MS).unref();

  // Run once shortly after boot so a fresh deploy doesn't wait a full tick.
  setTimeout(() => void runDueSyncs(), 5_000).unref();
}
