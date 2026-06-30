import { getPool, sql } from '../pool';
import { toIso } from '../utils';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalEventType = 'submitted' | 'comment' | 'approved' | 'rejected' | 'resubmitted';

export interface ApprovalSubmissionRow {
  id: number;
  submissionType: string;
  clientId: number | null;
  clientName: string | null;
  campaignId: number | null;
  campaignName: string | null;
  title: string | null;
  caption: string | null;
  imagePath: string | null;
  canvaDesignId: string | null;
  status: ApprovalStatus;
  submittedBy: number;
  submittedByName: string;
  submittedByEmail: string;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalEventRow {
  id: number;
  submissionId: number;
  eventType: ApprovalEventType;
  comment: string | null;
  actorId: number;
  actorName: string;
  createdAt: string;
}

function mapSubmission(r: Record<string, unknown>): ApprovalSubmissionRow {
  return {
    id: Number(r.id),
    submissionType: String(r.submission_type),
    clientId: r.client_id != null ? Number(r.client_id) : null,
    clientName: (r.client_name as string) ?? null,
    campaignId: r.campaign_id != null ? Number(r.campaign_id) : null,
    campaignName: (r.campaign_name as string) ?? null,
    title: (r.title as string) ?? null,
    caption: (r.caption as string) ?? null,
    imagePath: (r.image_path as string) ?? null,
    canvaDesignId: (r.canva_design_id as string) ?? null,
    status: String(r.status) as ApprovalStatus,
    submittedBy: Number(r.submitted_by),
    submittedByName: String(r.submitted_by_name),
    submittedByEmail: String(r.submitted_by_email),
    decidedBy: r.decided_by != null ? Number(r.decided_by) : null,
    decidedByName: (r.decided_by_name as string) ?? null,
    decidedAt: toIso(r.decided_at),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
  };
}

function mapEvent(r: Record<string, unknown>): ApprovalEventRow {
  return {
    id: Number(r.id),
    submissionId: Number(r.submission_id),
    eventType: String(r.event_type) as ApprovalEventType,
    comment: (r.comment as string) ?? null,
    actorId: Number(r.actor_id),
    actorName: String(r.actor_name),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  };
}

const SUBMISSION_SELECT = `
  SELECT s.id, s.submission_type, s.client_id, cl.name AS client_name,
         s.campaign_id, c.campaign_name AS campaign_name,
         s.title, s.caption, s.image_path, s.canva_design_id, s.status,
         s.submitted_by, su.name AS submitted_by_name, su.email AS submitted_by_email,
         s.decided_by, du.name AS decided_by_name,
         s.decided_at, s.created_at, s.updated_at
  FROM dbo.approval_submissions s
  LEFT JOIN dbo.clients cl ON cl.id = s.client_id
  LEFT JOIN dbo.google_ads_campaigns c ON c.id = s.campaign_id
  JOIN dbo.users su ON su.id = s.submitted_by
  LEFT JOIN dbo.users du ON du.id = s.decided_by
`;

export interface CreateSubmissionParams {
  clientId: number | null;
  campaignId: number | null;
  title: string | null;
  caption: string | null;
  imagePath: string;
  submittedBy: number;
}

/** Creates a submission (status=pending) and its initial 'submitted' event. */
export async function createSubmission(p: CreateSubmissionParams): Promise<number> {
  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    const insertRes = await tx
      .request()
      .input('clientId', sql.Int, p.clientId)
      .input('campaignId', sql.Int, p.campaignId)
      .input('title', sql.NVarChar(200), p.title)
      .input('caption', sql.NVarChar(2000), p.caption)
      .input('imagePath', sql.NVarChar(500), p.imagePath)
      .input('submittedBy', sql.Int, p.submittedBy)
      .query(`
        INSERT INTO dbo.approval_submissions
          (client_id, campaign_id, title, caption, image_path, submitted_by)
        OUTPUT inserted.id
        VALUES (@clientId, @campaignId, @title, @caption, @imagePath, @submittedBy)
      `);
    const id = Number(insertRes.recordset[0].id);

    await tx
      .request()
      .input('submissionId', sql.Int, id)
      .input('actorId', sql.Int, p.submittedBy)
      .query(`
        INSERT INTO dbo.approval_events (submission_id, event_type, actor_id)
        VALUES (@submissionId, 'submitted', @actorId)
      `);

    await tx.commit();
    return id;
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export interface ListSubmissionsFilters {
  status?: ApprovalStatus;
  submittedBy?: number;
}

export async function listSubmissions(filters: ListSubmissionsFilters = {}): Promise<ApprovalSubmissionRow[]> {
  const pool = await getPool();
  const req = pool.request();
  const where: string[] = [];
  if (filters.status) {
    req.input('status', sql.NVarChar(20), filters.status);
    where.push('s.status = @status');
  }
  if (filters.submittedBy !== undefined) {
    req.input('submittedBy', sql.Int, filters.submittedBy);
    where.push('s.submitted_by = @submittedBy');
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = await req.query(`${SUBMISSION_SELECT} ${whereSql} ORDER BY s.created_at DESC`);
  return res.recordset.map(mapSubmission);
}

export async function getSubmissionById(id: number): Promise<ApprovalSubmissionRow | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('id', sql.Int, id)
    .query(`${SUBMISSION_SELECT} WHERE s.id = @id`);
  return res.recordset[0] ? mapSubmission(res.recordset[0]) : null;
}

export async function listEventsForSubmission(submissionId: number): Promise<ApprovalEventRow[]> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('submissionId', sql.Int, submissionId)
    .query(`
      SELECT e.id, e.submission_id, e.event_type, e.comment, e.actor_id, u.name AS actor_name, e.created_at
      FROM dbo.approval_events e
      JOIN dbo.users u ON u.id = e.actor_id
      WHERE e.submission_id = @submissionId
      ORDER BY e.created_at ASC, e.id ASC
    `);
  return res.recordset.map(mapEvent);
}

export async function addEvent(
  submissionId: number,
  eventType: ApprovalEventType,
  actorId: number,
  comment: string | null,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('submissionId', sql.Int, submissionId)
    .input('eventType', sql.NVarChar(20), eventType)
    .input('actorId', sql.Int, actorId)
    .input('comment', sql.NVarChar(2000), comment)
    .query(`
      INSERT INTO dbo.approval_events (submission_id, event_type, actor_id, comment)
      VALUES (@submissionId, @eventType, @actorId, @comment)
    `);
}

export async function setDecision(
  submissionId: number,
  decidedBy: number,
  status: 'approved' | 'rejected',
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, submissionId)
    .input('status', sql.NVarChar(20), status)
    .input('decidedBy', sql.Int, decidedBy)
    .query(`
      UPDATE dbo.approval_submissions
      SET status = @status, decided_by = @decidedBy, decided_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
      WHERE id = @id
    `);
}

export async function resetToPending(
  submissionId: number,
  newImagePath: string | null,
  newCaption: string | null,
  newTitle: string | null,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, submissionId)
    .input('imagePath', sql.NVarChar(500), newImagePath)
    .input('caption', sql.NVarChar(2000), newCaption)
    .input('title', sql.NVarChar(200), newTitle)
    .query(`
      UPDATE dbo.approval_submissions
      SET status = 'pending',
          decided_by = NULL,
          decided_at = NULL,
          image_path = COALESCE(@imagePath, image_path),
          caption = COALESCE(@caption, caption),
          title = COALESCE(@title, title),
          updated_at = SYSUTCDATETIME()
      WHERE id = @id
    `);
}
