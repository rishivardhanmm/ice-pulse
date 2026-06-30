import sql from 'mssql';
import { getMssqlConfig, getServerEnv } from '../config/env';
import { logger } from '../logger';

/**
 * Shared MSSQL connection pool.
 *
 * Driver is selected by MSSQL_AUTH:
 *  - "windows" → mssql/msnodesqlv8 (Windows Integrated Security / trusted connection)
 *  - "sql"     → mssql (tedious) with username/password
 *
 * The promise is cached; a failed initial connection clears it so the next
 * call can retry rather than being stuck with a rejected promise.
 */

let poolPromise: Promise<sql.ConnectionPool> | null = null;

/** Returns the mssql driver matching the configured auth mode. */
export async function getMssqlDriver(): Promise<typeof sql> {
  if (getServerEnv().MSSQL_AUTH === 'windows') {
    try {
      const mod = (await import('mssql/msnodesqlv8')) as { default?: typeof sql };
      if (mod.default) return mod.default;
    } catch (err) {
      throw new Error(
        'MSSQL_AUTH=windows needs the native msnodesqlv8 driver, which is not installed ' +
          '(it is optional and not supported on Linux). Use MSSQL_AUTH=sql with a SQL login instead. ' +
          `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return sql;
}

async function createPool(): Promise<sql.ConnectionPool> {
  const config = getMssqlConfig();
  const driver = await getMssqlDriver();
  const pool = new driver.ConnectionPool(config as sql.config);
  pool.on('error', (err: Error) => logger.error('MSSQL pool error', { error: err.message }));
  try {
    return await pool.connect();
  } catch (err) {
    poolPromise = null; // allow a retry on the next call
    const env = getServerEnv();
    const endpoint = env.MSSQL_INSTANCE
      ? `${env.MSSQL_SERVER}\\${env.MSSQL_INSTANCE}`
      : `${env.MSSQL_SERVER},${env.MSSQL_PORT}`;
    const target = `${endpoint}/${env.MSSQL_DATABASE}`;
    const message =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
    throw new Error(
      `Could not connect to MSSQL "${target}" (auth: ${env.MSSQL_AUTH}). ` +
        `Check SQL Server is running and the MSSQL_* values in .env.local are correct. ` +
        `Underlying error: ${message}`,
    );
  }
}

export function getPool(): Promise<sql.ConnectionPool> {
  if (poolPromise) return poolPromise;
  poolPromise = createPool();
  return poolPromise;
}

export async function getRequest(): Promise<sql.Request> {
  const pool = await getPool();
  return pool.request();
}

export async function closePool(): Promise<void> {
  if (poolPromise) {
    try {
      const pool = await poolPromise;
      await pool.close();
    } catch {
      /* ignore close errors */
    } finally {
      poolPromise = null;
    }
  }
}

export { sql };
