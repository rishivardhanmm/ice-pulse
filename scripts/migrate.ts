import './_env';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPool, closePool, getMssqlDriver, sql } from '../src/server/db/pool';
import { logger, toErrorMessage } from '../src/server/logger';
import { describeConfigState, getMssqlConfig, getServerEnv } from '../src/server/config/env';

/**
 * Applies every *.sql file in database/migrations in filename order, exactly
 * once. Applied files are tracked in dbo.schema_migrations so the command is
 * safe to re-run. Each file runs in its own transaction and is split on `GO`.
 */

const MIGRATIONS_DIR = resolve(process.cwd(), 'database', 'migrations');

async function ensureMigrationsTable(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'schema_migrations')
    BEGIN
      CREATE TABLE dbo.schema_migrations (
        filename   NVARCHAR(255) NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
        applied_at DATETIME2(3)  NOT NULL CONSTRAINT DF_schema_migrations_applied DEFAULT (SYSUTCDATETIME())
      );
    END
  `);
}

function splitBatches(sqlText: string): string[] {
  return sqlText
    .split(/^\s*GO\s*$/gim)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function getApplied(pool: sql.ConnectionPool): Promise<Set<string>> {
  const result = await pool.request().query<{ filename: string }>(
    'SELECT filename FROM dbo.schema_migrations',
  );
  return new Set(result.recordset.map((r) => r.filename));
}

/**
 * Creates the application database if it does not exist by connecting to
 * `master` with the same auth. The database name is validated as a safe
 * identifier before being interpolated (CREATE DATABASE cannot be parameterised).
 */
async function ensureDatabaseExists(): Promise<void> {
  const dbName = getServerEnv().MSSQL_DATABASE;
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsafe MSSQL_DATABASE name: "${dbName}"`);
  }
  const driver = await getMssqlDriver();
  const masterPool = new driver.ConnectionPool(getMssqlConfig('master') as sql.config);
  await masterPool.connect();
  try {
    await masterPool.request().batch(`IF DB_ID('${dbName}') IS NULL CREATE DATABASE [${dbName}];`);
    logger.info('Ensured database exists', { database: dbName });
  } finally {
    await masterPool.close();
  }
}

async function main(): Promise<void> {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  logger.info('Starting migrations', describeConfigState().mssql);
  await ensureDatabaseExists();
  const pool = await getPool();
  await ensureMigrationsTable(pool);
  const applied = await getApplied(pool);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      logger.info('Skipping (already applied)', { file });
      continue;
    }
    const text = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const batches = splitBatches(text);
    const tx = pool.transaction();
    await tx.begin();
    try {
      for (const batch of batches) {
        await tx.request().batch(batch);
      }
      await tx
        .request()
        .input('filename', sql.NVarChar(255), file)
        .query('INSERT INTO dbo.schema_migrations (filename) VALUES (@filename)');
      await tx.commit();
      appliedCount += 1;
      logger.info('Applied migration', { file, batches: batches.length });
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw new Error(`Migration failed in ${file}: ${toErrorMessage(err)}`);
    }
  }

  logger.info('Migrations complete', { newlyApplied: appliedCount, totalFiles: files.length });
}

main()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch(async (err: unknown) => {
    logger.error('Migration run failed', { error: toErrorMessage(err) });
    await closePool().catch(() => undefined);
    process.exit(1);
  });
