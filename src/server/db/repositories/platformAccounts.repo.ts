import { getPool, sql } from '../pool';

export interface EnsureGoogleAdsAccountParams {
  clientId: number;
  customerId: string;
  accountName?: string | null;
  currencyCode?: string | null;
  timezone?: string | null;
}

/**
 * Upserts the Google Ads platform_account for a customer id and returns its id.
 * Existing rows keep their values unless the sync provides fresher ones.
 */
export async function ensureGoogleAdsAccount(
  params: EnsureGoogleAdsAccountParams,
): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('clientId', sql.Int, params.clientId)
    .input('platform', sql.NVarChar(40), 'google_ads')
    .input('externalId', sql.NVarChar(64), params.customerId)
    .input('accountName', sql.NVarChar(200), params.accountName ?? null)
    .input('currency', sql.NVarChar(8), params.currencyCode ?? null)
    .input('timezone', sql.NVarChar(64), params.timezone ?? null)
    .query(`
      MERGE dbo.platform_accounts AS t
      USING (SELECT @platform AS platform, @externalId AS external_account_id) AS s
        ON (t.platform = s.platform AND t.external_account_id = s.external_account_id)
      WHEN MATCHED THEN UPDATE SET
        account_name  = COALESCE(@accountName, t.account_name),
        currency_code = COALESCE(@currency, t.currency_code),
        timezone      = COALESCE(@timezone, t.timezone),
        updated_at    = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (client_id, platform, account_name, external_account_id, currency_code, timezone, status)
        VALUES (@clientId, @platform, @accountName, @externalId, @currency, @timezone, 'active')
      OUTPUT inserted.id AS id;
    `);
  return Number(result.recordset[0].id);
}

/** First known Google Ads account currency (for display), or null. */
export async function getGoogleAdsCurrency(): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT TOP 1 currency_code FROM dbo.platform_accounts
     WHERE platform = 'google_ads' AND currency_code IS NOT NULL
     ORDER BY id`,
  );
  return result.recordset.length ? (result.recordset[0].currency_code as string) : null;
}

/** First known Meta Ads account currency (for display), or null. */
export async function getMetaAdsCurrency(): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT TOP 1 currency_code FROM dbo.platform_accounts
     WHERE platform = 'meta_ads' AND currency_code IS NOT NULL
     ORDER BY id`,
  );
  return result.recordset.length ? (result.recordset[0].currency_code as string) : null;
}

/** Upserts the Meta Ads platform_account for an ad account and returns its id. */
export async function ensureMetaAdsAccount(params: {
  clientId: number;
  adAccountId: string;
  accountName?: string | null;
  currencyCode?: string | null;
  timezone?: string | null;
}): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('clientId', sql.Int, params.clientId)
    .input('platform', sql.NVarChar(40), 'meta_ads')
    .input('externalId', sql.NVarChar(64), params.adAccountId)
    .input('accountName', sql.NVarChar(200), params.accountName ?? null)
    .input('currency', sql.NVarChar(8), params.currencyCode ?? null)
    .input('timezone', sql.NVarChar(64), params.timezone ?? null)
    .query(`
      MERGE dbo.platform_accounts AS t
      USING (SELECT @platform AS platform, @externalId AS external_account_id) AS s
        ON (t.platform = s.platform AND t.external_account_id = s.external_account_id)
      WHEN MATCHED THEN UPDATE SET
        account_name  = COALESCE(@accountName, t.account_name),
        currency_code = COALESCE(@currency, t.currency_code),
        timezone      = COALESCE(@timezone, t.timezone),
        updated_at    = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (client_id, platform, account_name, external_account_id, currency_code, timezone, status)
        VALUES (@clientId, @platform, @accountName, @externalId, @currency, @timezone, 'active')
      OUTPUT inserted.id AS id;
    `);
  return Number(result.recordset[0].id);
}

/** First known Google Ads account name (for reports), or null. */
export async function getGoogleAdsAccountName(): Promise<string | null> {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT TOP 1 account_name FROM dbo.platform_accounts
     WHERE platform = 'google_ads' AND account_name IS NOT NULL
     ORDER BY id`,
  );
  return result.recordset.length ? (result.recordset[0].account_name as string) : null;
}
