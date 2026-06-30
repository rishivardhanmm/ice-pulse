import './_env';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPool, closePool } from '../src/server/db/pool';
import { logger, toErrorMessage } from '../src/server/logger';

/**
 * Runs every *.sql file in database/seeds in filename order. Seeds are written
 * with MERGE on natural keys, so they are idempotent and safe to re-run. Each
 * file executes inside its own transaction; batches are split on `GO`.
 */

const SEEDS_DIR = resolve(process.cwd(), 'database', 'seeds');

function splitBatches(sqlText: string): string[] {
  return sqlText
    .split(/^\s*GO\s*$/gim)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main(): Promise<void> {
  if (!existsSync(SEEDS_DIR)) {
    logger.warn('No seeds directory found — nothing to seed', { dir: SEEDS_DIR });
    return;
  }
  const pool = await getPool();
  const files = readdirSync(SEEDS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();

  for (const file of files) {
    const text = readFileSync(join(SEEDS_DIR, file), 'utf8');
    const batches = splitBatches(text);
    const tx = pool.transaction();
    await tx.begin();
    try {
      for (const batch of batches) {
        await tx.request().batch(batch);
      }
      await tx.commit();
      logger.info('Applied seed', { file, batches: batches.length });
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw new Error(`Seed failed in ${file}: ${toErrorMessage(err)}`);
    }
  }

  logger.info('Seeding complete', { files: files.length });
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err: unknown) => {
    logger.error('Seed run failed', { error: toErrorMessage(err) });
    await closePool().catch(() => undefined);
    process.exit(1);
  });
