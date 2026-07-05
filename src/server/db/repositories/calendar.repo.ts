import { getPool, sql } from '../pool';
import { toIso, toDateString } from '../utils';
import type { CalendarEventDTO, ManualCalendarEventInput } from '@/lib/types';

const GOOGLE_COLOR = '#4285F4';
const META_COLOR = '#1877F2';
const PENDING_COLOR = '#F59E0B';
const APPROVED_COLOR = '#22D3A0';
const REJECTED_COLOR = '#EF4444';
const MANUAL_COLOR = '#A78BFA';

// ── Google Ads campaigns ──────────────────────────────────────────────────────

export async function getGoogleAdsCampaigns(
  from: string,
  to: string,
  clientId?: number | null,
): Promise<CalendarEventDTO[]> {
  const pool = await getPool();
  let q =
    `SELECT c.id, c.campaign_name, c.campaign_status, c.start_date, c.end_date,
            cl.id AS client_id, cl.name AS client_name
     FROM dbo.google_ads_campaigns c
     JOIN dbo.platform_accounts pa ON pa.id = c.platform_account_id
     LEFT JOIN dbo.clients cl ON cl.id = pa.client_id
     WHERE c.start_date IS NOT NULL
       AND c.start_date <= @to
       AND (c.end_date IS NULL OR c.end_date >= @from)`;
  const req = pool.request()
    .input('from', sql.Date, new Date(`${from}T00:00:00Z`))
    .input('to', sql.Date, new Date(`${to}T00:00:00Z`));

  if (clientId) {
    q += ` AND pa.client_id = @clientId`;
    req.input('clientId', sql.Int, clientId);
  }

  const res = await req.query(q);
  return (res.recordset as Record<string, unknown>[]).map((r) => {
    const start = toDateString(r.start_date) ?? from;
    const end = toDateString(r.end_date) ?? start;
    return {
      id: `gads-${r.id}`,
      title: String(r.campaign_name ?? 'Google Ads Campaign'),
      start,
      end,
      type: 'google_ads',
      color: GOOGLE_COLOR,
      clientName: r.client_name ? String(r.client_name) : null,
      clientId: r.client_id != null ? Number(r.client_id) : null,
      status: r.campaign_status ? String(r.campaign_status) : undefined,
      href: '/google-ads',
    };
  });
}

// ── Meta Ads campaigns (derive dates from daily metrics) ──────────────────────

export async function getMetaAdsCampaigns(
  from: string,
  to: string,
  clientId?: number | null,
): Promise<CalendarEventDTO[]> {
  const pool = await getPool();
  let q =
    `SELECT c.id, c.campaign_name, c.campaign_status, c.client_id,
            cl.name AS client_name,
            MIN(m.metric_date) AS start_date,
            MAX(m.metric_date) AS end_date
     FROM dbo.meta_ads_campaigns c
     LEFT JOIN dbo.clients cl ON cl.id = c.client_id
     JOIN dbo.meta_ads_campaign_daily_metrics m ON m.campaign_id = c.id
     WHERE m.metric_date >= @from AND m.metric_date <= @to`;
  const req = pool.request()
    .input('from', sql.Date, new Date(`${from}T00:00:00Z`))
    .input('to', sql.Date, new Date(`${to}T00:00:00Z`));

  if (clientId) {
    q += ` AND c.client_id = @clientId`;
    req.input('clientId', sql.Int, clientId);
  }
  q += ` GROUP BY c.id, c.campaign_name, c.campaign_status, c.client_id, cl.name`;

  const res = await req.query(q);
  return (res.recordset as Record<string, unknown>[]).map((r) => {
    const start = toDateString(r.start_date) ?? from;
    const end = toDateString(r.end_date) ?? start;
    return {
      id: `meta-${r.id}`,
      title: String(r.campaign_name ?? 'Meta Ads Campaign'),
      start,
      end,
      type: 'meta_ads',
      color: META_COLOR,
      clientName: r.client_name ? String(r.client_name) : null,
      clientId: r.client_id != null ? Number(r.client_id) : null,
      status: r.campaign_status ? String(r.campaign_status) : undefined,
      href: '/sync',
    };
  });
}

// ── Approval submissions ──────────────────────────────────────────────────────

export async function getApprovalEvents(
  from: string,
  to: string,
  clientId?: number | null,
): Promise<CalendarEventDTO[]> {
  const pool = await getPool();
  let q =
    `SELECT s.id, s.title, s.status, s.client_id, s.created_at, s.decided_at,
            cl.name AS client_name
     FROM dbo.approval_submissions s
     LEFT JOIN dbo.clients cl ON cl.id = s.client_id
     WHERE CAST(s.created_at AS DATE) >= @from
       AND CAST(s.created_at AS DATE) <= @to`;
  const req = pool.request()
    .input('from', sql.Date, new Date(`${from}T00:00:00Z`))
    .input('to', sql.Date, new Date(`${to}T00:00:00Z`));

  if (clientId) {
    q += ` AND s.client_id = @clientId`;
    req.input('clientId', sql.Int, clientId);
  }

  const res = await req.query(q);
  return (res.recordset as Record<string, unknown>[]).map((r) => {
    const status = String(r.status ?? 'pending');
    const color =
      status === 'approved' ? APPROVED_COLOR : status === 'rejected' ? REJECTED_COLOR : PENDING_COLOR;
    const start = toDateString(r.created_at) ?? from;
    const end = r.decided_at ? (toDateString(r.decided_at) ?? start) : start;
    return {
      id: `appr-${r.id}`,
      title: r.title ? String(r.title) : 'Content Approval',
      start,
      end,
      type: 'approval',
      color,
      clientName: r.client_name ? String(r.client_name) : null,
      clientId: r.client_id != null ? Number(r.client_id) : null,
      status,
      href: `/approvals/${r.id}`,
    };
  });
}

// ── Manual events ─────────────────────────────────────────────────────────────

export async function getManualEvents(
  from: string,
  to: string,
  clientId?: number | null,
): Promise<CalendarEventDTO[]> {
  const pool = await getPool();
  let q =
    `SELECT e.id, e.title, e.start_date, e.end_date, e.color, e.notes,
            e.client_id, cl.name AS client_name
     FROM dbo.calendar_events e
     LEFT JOIN dbo.clients cl ON cl.id = e.client_id
     WHERE e.start_date <= @to
       AND (e.end_date IS NULL OR e.end_date >= @from)
       OR (e.end_date IS NULL AND e.start_date >= @from AND e.start_date <= @to)`;
  const req = pool.request()
    .input('from', sql.Date, new Date(`${from}T00:00:00Z`))
    .input('to', sql.Date, new Date(`${to}T00:00:00Z`));

  if (clientId) {
    q += ` AND e.client_id = @clientId`;
    req.input('clientId', sql.Int, clientId);
  }

  const res = await req.query(q);
  return (res.recordset as Record<string, unknown>[]).map((r) => {
    const start = toDateString(r.start_date) ?? from;
    const end = r.end_date ? (toDateString(r.end_date) ?? start) : start;
    return {
      id: `manual-${r.id}`,
      title: String(r.title),
      start,
      end,
      type: 'manual',
      color: r.color ? String(r.color) : MANUAL_COLOR,
      clientName: r.client_name ? String(r.client_name) : null,
      clientId: r.client_id != null ? Number(r.client_id) : null,
    };
  });
}

const ZOHO_COLOR = '#E05735'; // Zoho brand orange

// ── Zoho Social scheduled posts ───────────────────────────────────────────────

export async function getZohoScheduledEvents(
  from: string,
  to: string,
  clientId?: number | null,
): Promise<CalendarEventDTO[]> {
  const pool = await getPool();
  let q =
    `SELECT zs.id, zs.content_text, zs.network, zs.scheduled_at, zs.status,
            b.client_id, cl.name AS client_name, b.name AS brand_name
     FROM dbo.zoho_scheduled_posts zs
     JOIN dbo.zoho_social_profiles prof ON prof.id = zs.profile_id
     JOIN dbo.zoho_social_brands b ON b.id = prof.brand_id
     LEFT JOIN dbo.clients cl ON cl.id = b.client_id
     WHERE CAST(zs.scheduled_at AS DATE) >= @from
       AND CAST(zs.scheduled_at AS DATE) <= @to
       AND zs.status = 'scheduled'`;
  const req = pool.request()
    .input('from', sql.Date, new Date(`${from}T00:00:00Z`))
    .input('to', sql.Date, new Date(`${to}T00:00:00Z`));

  if (clientId) {
    q += ` AND b.client_id = @clientId`;
    req.input('clientId', sql.Int, clientId);
  }

  let res;
  try {
    res = await req.query(q);
  } catch {
    return []; // table may not exist pre-migration
  }

  return (res.recordset as Record<string, unknown>[]).map((r) => {
    const dateStr = toDateString(r.scheduled_at) ?? from;
    const network = String(r.network ?? '');
    const textPreview = r.content_text
      ? String(r.content_text).slice(0, 40) + (String(r.content_text).length > 40 ? '…' : '')
      : 'Scheduled post';
    return {
      id: `zoho-${r.id}`,
      title: `[${network.charAt(0).toUpperCase() + network.slice(1)}] ${textPreview}`,
      start: dateStr,
      end: dateStr,
      type: 'zoho_social',
      color: ZOHO_COLOR,
      clientName: r.client_name ? String(r.client_name) : null,
      clientId: r.client_id != null ? Number(r.client_id) : null,
      status: 'scheduled',
      href: '/social-posts',
    };
  });
}

export async function createManualEvent(
  p: ManualCalendarEventInput & { createdBy: number },
): Promise<number> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('title', sql.NVarChar(200), p.title.slice(0, 200))
    .input('startDate', sql.Date, new Date(`${p.startDate}T00:00:00Z`))
    .input('endDate', sql.Date, p.endDate ? new Date(`${p.endDate}T00:00:00Z`) : null)
    .input('clientId', sql.Int, p.clientId ?? null)
    .input('color', sql.NVarChar(20), p.color ?? null)
    .input('notes', sql.NVarChar(1000), p.notes ?? null)
    .input('createdBy', sql.Int, p.createdBy)
    .query(
      `INSERT INTO dbo.calendar_events (title, start_date, end_date, client_id, color, notes, created_by)
       OUTPUT inserted.id
       VALUES (@title, @startDate, @endDate, @clientId, @color, @notes, @createdBy)`,
    );
  return Number(res.recordset[0].id);
}

export async function deleteManualEvent(id: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`DELETE FROM dbo.calendar_events WHERE id = @id`);
}
