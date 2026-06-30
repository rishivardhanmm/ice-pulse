import { getPool, sql } from '../pool';
import { parseDateInput } from '../utils';

export interface UpsertCampaignParams {
  platformAccountId: number;
  googleCustomerId: string;
  googleCampaignId: string;
  name?: string | null;
  status?: string | null;
  channelType?: string | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
}

export type UpsertAction = 'INSERT' | 'UPDATE';

/** Upsert campaign identity by (customer id, campaign id). Returns the row id. */
export async function upsertCampaign(
  p: UpsertCampaignParams,
): Promise<{ id: number; action: UpsertAction }> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('platformAccountId', sql.Int, p.platformAccountId)
    .input('customerId', sql.NVarChar(32), p.googleCustomerId)
    .input('campaignId', sql.NVarChar(32), p.googleCampaignId)
    .input('name', sql.NVarChar(512), p.name ?? null)
    .input('status', sql.NVarChar(40), p.status ?? null)
    .input('channelType', sql.NVarChar(64), p.channelType ?? null)
    .input('startDate', sql.Date, p.startDate ? parseDateInput(p.startDate) : null)
    .input('endDate', sql.Date, p.endDate ? parseDateInput(p.endDate) : null)
    .query(`
      MERGE dbo.google_ads_campaigns AS t
      USING (SELECT @customerId AS google_customer_id, @campaignId AS google_campaign_id) AS s
        ON (t.google_customer_id = s.google_customer_id AND t.google_campaign_id = s.google_campaign_id)
      WHEN MATCHED THEN UPDATE SET
        platform_account_id      = @platformAccountId,
        campaign_name            = @name,
        campaign_status          = @status,
        advertising_channel_type = @channelType,
        start_date               = @startDate,
        end_date                 = @endDate,
        updated_at               = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT
        (platform_account_id, google_customer_id, google_campaign_id, campaign_name,
         campaign_status, advertising_channel_type, start_date, end_date)
        VALUES (@platformAccountId, @customerId, @campaignId, @name, @status,
                @channelType, @startDate, @endDate)
      OUTPUT inserted.id AS id, $action AS action;
    `);
  const row = result.recordset[0];
  return { id: Number(row.id), action: String(row.action) as UpsertAction };
}

/** Distinct campaign statuses and channel types, for filter dropdowns. */
export async function getDistinctFilters(): Promise<{
  statuses: string[];
  channelTypes: string[];
}> {
  const pool = await getPool();
  const statusResult = await pool.request().query(
    `SELECT DISTINCT campaign_status FROM dbo.google_ads_campaigns
     WHERE campaign_status IS NOT NULL ORDER BY campaign_status`,
  );
  const channelResult = await pool.request().query(
    `SELECT DISTINCT advertising_channel_type FROM dbo.google_ads_campaigns
     WHERE advertising_channel_type IS NOT NULL ORDER BY advertising_channel_type`,
  );
  return {
    statuses: statusResult.recordset.map((r) => String(r.campaign_status)),
    channelTypes: channelResult.recordset.map((r) => String(r.advertising_channel_type)),
  };
}

/** True if any daily metric rows exist at all. */
export async function hasAnyMetrics(): Promise<boolean> {
  const pool = await getPool();
  const result = await pool.request().query(
    `SELECT TOP 1 1 AS present FROM dbo.google_ads_campaign_daily_metrics`,
  );
  return result.recordset.length > 0;
}

export interface CampaignWithAssignment {
  id: number;
  googleCampaignId: string;
  campaignName: string | null;
  campaignStatus: string | null;
  clientId: number | null;
  clientName: string | null;
  clientSlug: string | null;
}

/** All campaigns with their current client assignment. */
export async function listCampaignsWithAssignment(): Promise<CampaignWithAssignment[]> {
  const pool = await getPool();
  const res = await pool.request().query(
    `SELECT c.id, c.google_campaign_id, c.campaign_name, c.campaign_status,
            c.client_id, cl.name AS client_name, cl.slug AS client_slug
     FROM dbo.google_ads_campaigns c
     LEFT JOIN dbo.clients cl ON cl.id = c.client_id
     ORDER BY c.campaign_name`,
  );
  return res.recordset.map((r) => ({
    id: Number(r.id),
    googleCampaignId: String(r.google_campaign_id),
    campaignName: (r.campaign_name as string) ?? null,
    campaignStatus: (r.campaign_status as string) ?? null,
    clientId: r.client_id != null ? Number(r.client_id) : null,
    clientName: (r.client_name as string) ?? null,
    clientSlug: (r.client_slug as string) ?? null,
  }));
}

/** Campaign IDs assigned to a specific client. */
export async function getCampaignIdsForClient(clientId: number): Promise<number[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('clientId', sql.Int, clientId)
    .query(
      `SELECT id FROM dbo.google_ads_campaigns WHERE client_id = @clientId`,
    );
  return res.recordset.map((r) => Number(r.id));
}

/** Assign (or unassign) a campaign to a client. Pass null clientId to unassign. */
export async function assignCampaignToClient(
  campaignId: number,
  clientId: number | null,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, campaignId)
    .input('clientId', sql.Int, clientId)
    .query(
      `UPDATE dbo.google_ads_campaigns
       SET client_id = @clientId, updated_at = SYSUTCDATETIME()
       WHERE id = @id`,
    );
}
