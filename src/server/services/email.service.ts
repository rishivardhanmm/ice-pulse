import { getSendGridConfig, getServerEnv, isEmailConfigured } from '../config/env';
import { logger, toErrorMessage } from '../logger';
import type { ApprovalSubmissionRow } from '../db/repositories/approvals.repo';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends a single email via SendGrid. Never throws — logs and no-ops on failure or when
 * unconfigured, so a SendGrid outage can never break the approval/submission flow.
 *
 * While EMAIL_OVERRIDE_TO is set (testing only), every email is redirected to that
 * address instead of its real recipient, with the original recipient noted in the body.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn('Email not configured — skipping send', { to: params.to, subject: params.subject });
    return;
  }
  const override = getServerEnv().EMAIL_OVERRIDE_TO;
  const to = override || params.to;
  const html = override
    ? `<p style="background:#fff3cd;border-radius:8px;padding:10px 12px;margin:0 0 16px;font-size:12px;">
         TEST MODE — would normally have gone to <strong>${params.to}</strong>.
       </p>${params.html}`
    : params.html;

  try {
    const cfg = getSendGridConfig();
    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(cfg.apiKey);
    await sgMail.send({
      to,
      from: { email: cfg.fromEmail, name: cfg.fromName },
      subject: params.subject,
      html,
    });
  } catch (err) {
    logger.error('Failed to send email', { to, subject: params.subject, error: toErrorMessage(err) });
  }
}

function wrapper(title: string, bodyHtml: string, appUrl: string, linkHref: string, linkLabel: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="margin: 0 0 16px;">${title}</h2>
      ${bodyHtml}
      <p style="margin: 24px 0 0;">
        <a href="${appUrl}${linkHref}" style="display: inline-block; background: #FFD500; color: #14082a; font-weight: 700; padding: 10px 18px; border-radius: 10px; text-decoration: none;">
          ${linkLabel}
        </a>
      </p>
      <p style="margin: 24px 0 0; font-size: 11px; color: #888;">ICE Pulse — automated notification.</p>
    </div>
  `;
}

export function submissionCreatedEmail(submission: ApprovalSubmissionRow, appUrl: string): SendEmailParams['html'] {
  const what = submission.title || 'New content';
  const client = submission.clientName ? ` for <strong>${submission.clientName}</strong>` : '';
  return wrapper(
    'New content submitted for approval',
    `<p><strong>${submission.submittedByName}</strong> submitted "${what}"${client} and it's waiting on your review.</p>`,
    appUrl,
    `/approvals/${submission.id}`,
    'Review submission',
  );
}

export function decisionMadeEmail(
  submission: ApprovalSubmissionRow,
  decision: 'approved' | 'rejected',
  deciderName: string,
  comment: string | null,
  appUrl: string,
): SendEmailParams['html'] {
  const what = submission.title || 'Your submission';
  const verb = decision === 'approved' ? 'approved' : 'rejected';
  const commentHtml = comment
    ? `<p style="background: #f5f5f7; border-radius: 8px; padding: 12px; margin-top: 12px;"><strong>Comment:</strong> ${comment}</p>`
    : '';
  return wrapper(
    `Your submission was ${verb}`,
    `<p><strong>${deciderName}</strong> ${verb} "${what}".</p>${commentHtml}`,
    appUrl,
    `/approvals/${submission.id}`,
    'View submission',
  );
}
