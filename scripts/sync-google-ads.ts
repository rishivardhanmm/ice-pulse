import './_env';
import { googleAdsConnector } from '../src/integrations/google-ads/connector';
import { closePool } from '../src/server/db/pool';
import { logger, toErrorMessage } from '../src/server/logger';

/**
 * CLI: pull Google Ads campaign performance into MSSQL.
 *
 *   npm run sync:google-ads
 *   npm run sync:google-ads -- --from=2026-06-01 --to=2026-06-16
 *
 * Default range is the last 30 days (inclusive of today). Safe to run multiple
 * times — metrics are upserted on (campaign, date).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const USAGE = 'Usage: npm run sync:google-ads -- --from=YYYY-MM-DD --to=YYYY-MM-DD';

function parseArgs(argv: string[]): { from?: string; to?: string } {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq >= 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      }
    }
  }
  return { from: out.from, to: out.to };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveRange(from?: string, to?: string): { from: string; to: string } {
  const toDate = to ?? todayUtc();
  const fromDate = from ?? shiftDays(toDate, -29);
  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    throw new Error(`Dates must be in YYYY-MM-DD format. ${USAGE}`);
  }
  if (fromDate > toDate) {
    throw new Error(`--from (${fromDate}) must not be after --to (${toDate}). ${USAGE}`);
  }
  return { from: fromDate, to: toDate };
}

async function main(): Promise<void> {
  const { from, to } = parseArgs(process.argv.slice(2));
  const range = resolveRange(from, to);
  logger.info('Starting Google Ads sync', range);

  const result = await googleAdsConnector.sync({ ...range, triggeredBy: 'cli' });

  if (result.status === 'failed') {
    logger.error('Google Ads sync FAILED', { error: result.errorMessage });
    process.exitCode = 1;
    return;
  }

  logger.info('Google Ads sync SUCCEEDED', {
    range: `${range.from} → ${range.to}`,
    processed: result.recordsProcessed,
    inserted: result.recordsInserted,
    updated: result.recordsUpdated,
  });
}

async function shutdown(): Promise<void> {
  await closePool().catch(() => undefined);
  // Don't force process.exit() immediately: on Windows, exiting while the
  // Google-auth HTTP keep-alive sockets are still closing can trip a libuv
  // assertion. Let the loop drain; an unref'd timer is a safety net only.
  setTimeout(() => process.exit(process.exitCode ?? 0), 8000).unref();
}

main()
  .catch((err: unknown) => {
    logger.error('Google Ads sync crashed', { error: toErrorMessage(err) });
    process.exitCode = 1;
  })
  .finally(shutdown);
