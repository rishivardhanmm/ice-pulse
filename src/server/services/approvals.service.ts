import { getPool, sql } from '../db/pool';
import {
  addEvent,
  createSubmission,
  getSubmissionById,
  listEventsForSubmission,
  listReviewers,
  listSubmissions,
  resetToPending,
  setDecision,
  setReviewers,
  type ApprovalSubmissionRow,
  type ApprovalEventRow,
  type ApprovalStatus,
  type ReviewerRow,
} from '../db/repositories/approvals.repo';
import { listApprovers } from '../db/repositories/users.repo';
import { getServerEnv } from '../config/env';
import { sendEmail, submissionCreatedEmail, decisionMadeEmail } from './email.service';

/**
 * Notifies the people who should review this submission: the named reviewers
 * when the submitter picked some, otherwise everyone with approval power.
 * The submitter is never notified about their own submission.
 */
async function notifyApprovers(submission: ApprovalSubmissionRow): Promise<void> {
  const named = await listReviewers(submission.id);
  const recipients =
    named.length > 0
      ? named
          .filter((r) => r.userId !== submission.submittedBy)
          .map((r) => ({ email: r.email }))
      : await listApprovers(submission.submittedBy);
  const appUrl = getServerEnv().APP_URL;
  await Promise.all(
    recipients.map((a) =>
      sendEmail({
        to: a.email,
        subject: `Approval needed: ${submission.title || 'New content'}`,
        html: submissionCreatedEmail(submission, appUrl),
      }),
    ),
  );
}

export class ApprovalError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Whether a user currently has approval power. Always re-checked against the DB
 * (never trusted from the JWT) so a demoted approver loses power immediately.
 * System admins always have implicit approval power.
 */
export async function userCanApprove(userId: number, systemRole: string): Promise<boolean> {
  if (systemRole === 'admin') return true;
  const pool = await getPool();
  const res = await pool
    .request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT ISNULL(tr.can_approve, 0) AS can_approve
      FROM dbo.users u
      LEFT JOIN dbo.team_roles tr ON tr.id = u.team_role_id
      WHERE u.id = @userId
    `);
  return Boolean(res.recordset[0]?.can_approve);
}

export interface SubmissionDetail {
  submission: ApprovalSubmissionRow;
  events: ApprovalEventRow[];
  reviewers: ReviewerRow[];
  canDecide: boolean;
}

export async function getSubmissionDetail(
  id: number,
  viewerId: number,
  viewerRole: string,
): Promise<SubmissionDetail | null> {
  const submission = await getSubmissionById(id);
  if (!submission) return null;
  const [events, reviewers] = await Promise.all([
    listEventsForSubmission(id),
    listReviewers(id),
  ]);

  const hasApprovePower = await userCanApprove(viewerId, viewerRole);
  const isSelf = submission.submittedBy === viewerId;
  // When reviewers are named, only they (or an admin) may decide.
  const isNamedReviewer =
    reviewers.length === 0 ||
    viewerRole === 'admin' ||
    reviewers.some((r) => r.userId === viewerId);
  const canDecide = submission.status === 'pending' && hasApprovePower && !isSelf && isNamedReviewer;

  return { submission, events, reviewers, canDecide };
}

export async function submitContent(p: {
  clientId: number | null;
  campaignId: number | null;
  title: string | null;
  caption: string | null;
  imagePath: string;
  submittedBy: number;
  /** Ask these specific people for approval (empty = anyone with approval power). */
  reviewerIds?: number[];
}): Promise<number> {
  const id = await createSubmission(p);
  if (p.reviewerIds && p.reviewerIds.length > 0) {
    // Only people who actually hold approval power can be asked.
    const approvers = await listApprovers();
    const valid = p.reviewerIds.filter(
      (rid) => rid !== p.submittedBy && approvers.some((a) => a.id === rid),
    );
    if (valid.length > 0) await setReviewers(id, valid);
  }
  const submission = await getSubmissionById(id);
  if (submission) void notifyApprovers(submission);
  return id;
}

export async function listForViewer(filters: { status?: ApprovalStatus; mine?: boolean }, viewerId: number) {
  return listSubmissions({
    status: filters.status,
    submittedBy: filters.mine ? viewerId : undefined,
  });
}

export async function addComment(submissionId: number, actorId: number, comment: string): Promise<void> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) throw new ApprovalError('Submission not found.', 404);
  if (!comment.trim()) throw new ApprovalError('Comment cannot be empty.', 400);
  await addEvent(submissionId, 'comment', actorId, comment.trim());
}

export async function decide(
  submissionId: number,
  actorId: number,
  actorRole: string,
  actorName: string,
  decision: 'approved' | 'rejected',
  comment: string | null,
): Promise<void> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) throw new ApprovalError('Submission not found.', 404);
  if (submission.status !== 'pending') {
    throw new ApprovalError('This submission has already been decided.', 400);
  }
  if (submission.submittedBy === actorId) {
    throw new ApprovalError('You cannot approve or reject your own submission.', 403);
  }
  const hasPower = await userCanApprove(actorId, actorRole);
  if (!hasPower) {
    throw new ApprovalError('You do not have approval power.', 403);
  }
  // When the submitter asked specific people, only they (or an admin) may decide.
  const reviewers = await listReviewers(submissionId);
  if (
    reviewers.length > 0 &&
    actorRole !== 'admin' &&
    !reviewers.some((r) => r.userId === actorId)
  ) {
    throw new ApprovalError('This submission was sent to specific reviewers — only they can decide it.', 403);
  }

  const trimmedComment = comment?.trim() || null;
  await setDecision(submissionId, actorId, decision);
  await addEvent(submissionId, decision, actorId, trimmedComment);

  const appUrl = getServerEnv().APP_URL;
  void sendEmail({
    to: submission.submittedByEmail,
    subject: `Your submission was ${decision}: ${submission.title || 'Untitled'}`,
    html: decisionMadeEmail(submission, decision, actorName, trimmedComment, appUrl),
  });
}

export async function resubmit(
  submissionId: number,
  actorId: number,
  updates: { imagePath: string | null; caption: string | null; title: string | null },
): Promise<void> {
  const submission = await getSubmissionById(submissionId);
  if (!submission) throw new ApprovalError('Submission not found.', 404);
  if (submission.submittedBy !== actorId) {
    throw new ApprovalError('Only the original submitter can resubmit.', 403);
  }
  if (submission.status !== 'rejected') {
    throw new ApprovalError('Only rejected submissions can be resubmitted.', 400);
  }

  await resetToPending(submissionId, updates.imagePath, updates.caption, updates.title);
  await addEvent(submissionId, 'resubmitted', actorId, null);

  const updated = await getSubmissionById(submissionId);
  if (updated) void notifyApprovers(updated);
}
