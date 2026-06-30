import './_env';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { getPool, closePool } from '../src/server/db/pool';
import { getServerEnv } from '../src/server/config/env';
import { logger, toErrorMessage } from '../src/server/logger';

/**
 * DESTRUCTIVE: deletes every row from every application table, then resets each
 * table's IDENTITY seed back to 1. The schema (tables/columns/migration history) is
 * left intact, so `npm run db:migrate` does not need to be re-run afterwards.
 *
 * Asks for typed confirmation before touching anything. Does NOT create a new admin
 * user — run this right after:
 *   npm run auth:create-admin -- admin@icecreates.com "Admin Name" "ChoosePassword123!"
 *
 *   npm run db:reset
 *
 * NOTE: there is only one database configured per environment (MSSQL_SERVER /
 * MSSQL_DATABASE in .env.local) — there is no separate "safe" local DB. Read the
 * server/database printed below carefully before typing YES.
 */

// Leaf tables first, parents last — must respect current FK dependency order
// (see database/migrations/*.sql). Update this list when a migration adds a table.
const TABLES_IN_DELETE_ORDER = [
  'approval_events',
  'client_budget',
  'approval_submissions',
  'canva_export_jobs',
  'canva_designs',
  'canva_templates',
  'canva_capabilities',
  'canva_oauth_tokens',
  'canva_connections',
  'google_ads_campaign_daily_metrics',
  'meta_ads_campaign_daily_metrics',
  'google_ads_campaigns',
  'meta_ads_campaigns',
  'platform_accounts',
  'users',
  'team_roles',
  'clients',
  'ai_usage',
  'sync_runs',
  'sync_schedules',
  'future_data_sources',
];

async function main(): Promise<void> {
  const env = getServerEnv();

  console.log('\n!!  DESTRUCTIVE OPERATION  !!');
  console.log('This permanently deletes ALL records from every table in:');
  console.log(`   Server:   ${env.MSSQL_SERVER}`);
  console.log(`   Database: ${env.MSSQL_DATABASE}`);
  console.log('\nThe schema and migration history are kept — only data is wiped. This cannot');
  console.log('be undone, and there is no separate "test" database — this is whatever');
  console.log('MSSQL_SERVER / MSSQL_DATABASE in your current .env.local point to.\n');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const answer = await rl.question('Type YES (all caps) to confirm, anything else cancels: ');
  rl.close();

  if (answer.trim() !== 'YES') {
    console.log('\nCancelled. No changes made.');
    return;
  }

  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    for (const table of TABLES_IN_DELETE_ORDER) {
      const result = await tx.request().query(`DELETE FROM dbo.${table}`);
      console.log(`   Deleted ${result.rowsAffected[0]} row(s) from ${table}`);
    }
    for (const table of TABLES_IN_DELETE_ORDER) {
      await tx.request().query(`
        IF OBJECTPROPERTY(OBJECT_ID('dbo.${table}'), 'TableHasIdentity') = 1
          DBCC CHECKIDENT ('dbo.${table}', RESEED, 0);
      `);
    }
    await tx.commit();
    console.log('\nOK  All records deleted. Database is empty (schema intact).');
    console.log('\nNext, create an admin account:');
    console.log('  npm run auth:create-admin -- admin@icecreates.com "Admin Name" "ChoosePassword123!"');
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err: unknown) => {
    logger.error('DB reset failed', { error: toErrorMessage(err) });
    await closePool().catch(() => undefined);
    process.exit(1);
  });
