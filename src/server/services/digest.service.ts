import { generateReport } from '../../ai/ai.service';
import { getSmartSignals } from './signals.service';
import { getRecentAnomalies } from './anomaly.service';
import { sendEmail } from './email.service';
import { listUsers } from '../db/repositories/users.repo';
import { getServerEnv } from '../config/env';
import { logger, toErrorMessage } from '../logger';
import { formatCurrency, formatNumber } from '../../lib/format';
import type { AiReportDTO, AnomalyDTO, Signal } from '../../lib/types';

/**
 * Weekly AI digest — one branded email that compiles the AI-written
 * performance report, the deterministic needs-attention signals and any
 * recent anomalies, sent to every active internal/admin user.
 *
 * While EMAIL_OVERRIDE_TO is set (test mode), email.service redirects every
 * message to that address, so this is safe to run before go-live.
 */

function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function li(items: string[]): string {
  return items.map((s) => `<li style="margin: 0 0 6px;">${esc(s)}</li>`).join('');
}

function severityColor(severity: string): string {
  return severity === 'warning' || severity === 'high' ? '#dc2643' : severity === 'positive' ? '#0b8a62' : '#b45309';
}

function digestHtml(report: AiReportDTO, signals: Signal[], anomalies: AnomalyDTO[], appUrl: string): string {
  const t = report.totals;
  const money = (n: number | null) => formatCurrency(n, report.currency);

  const kpiCell = (label: string, value: string) => `
    <td style="padding: 12px 14px; background: #f6f6f9; border-radius: 12px;">
      <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #8e86a6; margin-bottom: 4px;">${label}</div>
      <div style="font-size: 18px; font-weight: 700; color: #17102b;">${value}</div>
    </td>`;

  const signalRows = signals
    .slice(0, 6)
    .map(
      (s) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: ${severityColor(s.severity)}; margin-right: 8px;"></span>
          <strong>${esc(s.title)}</strong>
          <div style="font-size: 12px; color: #564d6e; margin: 2px 0 0 16px;">${esc(s.detail)}</div>
        </td>
      </tr>`,
    )
    .join('');

  const anomalyRows = anomalies
    .slice(0, 6)
    .map(
      (a) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 999px; background: ${severityColor(a.severity)}; margin-right: 8px;"></span>
          <strong>${esc(a.campaignName)}</strong> — ${a.metric} ${a.direction} (${a.metricDate})
          ${a.narrative ? `<div style="font-size: 12px; color: #564d6e; margin: 2px 0 0 16px;">${esc(a.narrative)}</div>` : ''}
        </td>
      </tr>`,
    )
    .join('');

  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #17102b;">
    <div style="background: linear-gradient(135deg, #180b33, #12071f); border-radius: 16px; padding: 24px; margin-bottom: 20px;">
      <div style="color: #ffd500; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px;">ICE Pulse — Weekly Digest</div>
      <h1 style="color: #ffffff; font-size: 20px; margin: 0;">${esc(report.headline)}</h1>
      <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 8px 0 0;">${report.dateRange.from} → ${report.dateRange.to}${report.account ? ` · ${esc(report.account)}` : ''}</p>
    </div>

    <p style="font-size: 14px; line-height: 1.6;">${esc(report.summary)}</p>

    <table role="presentation" width="100%" cellspacing="6" cellpadding="0" style="margin: 16px 0;">
      <tr>
        ${kpiCell('Spend', money(t.spend))}
        ${kpiCell('Clicks', formatNumber(t.clicks))}
        ${kpiCell('Conversions', formatNumber(t.conversions))}
      </tr>
      <tr>
        ${kpiCell('Impressions', formatNumber(t.impressions))}
        ${kpiCell('CTR', `${t.ctr}%`)}
        ${kpiCell('Cost / conv.', money(t.costPerConversion))}
      </tr>
    </table>

    ${report.highlights.length ? `<h3 style="font-size: 14px; margin: 20px 0 8px;">✨ Highlights</h3><ul style="padding-left: 18px; margin: 0; font-size: 13px; line-height: 1.5;">${li(report.highlights)}</ul>` : ''}
    ${report.concerns.length ? `<h3 style="font-size: 14px; margin: 20px 0 8px;">⚠️ Concerns</h3><ul style="padding-left: 18px; margin: 0; font-size: 13px; line-height: 1.5;">${li(report.concerns)}</ul>` : ''}
    ${report.recommendations.length ? `<h3 style="font-size: 14px; margin: 20px 0 8px;">💡 Recommendations</h3><ul style="padding-left: 18px; margin: 0; font-size: 13px; line-height: 1.5;">${li(report.recommendations)}</ul>` : ''}

    ${signalRows ? `<h3 style="font-size: 14px; margin: 24px 0 4px;">Needs attention</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">${signalRows}</table>` : ''}
    ${anomalyRows ? `<h3 style="font-size: 14px; margin: 24px 0 4px;">Anomaly watch</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">${anomalyRows}</table>` : ''}

    <p style="margin: 28px 0 0;">
      <a href="${appUrl}/" style="display: inline-block; background: #14082a; color: #ffffff; font-weight: 600; padding: 10px 20px; border-radius: 999px; text-decoration: none; font-size: 13px;">
        Open ICE Pulse
      </a>
    </p>
    <p style="margin: 20px 0 0; font-size: 11px; color: #8e86a6;">ICE Pulse — automated weekly digest. Generated by AI from your synced campaign data.</p>
  </div>`;
}

/** Composes and sends the weekly digest. Returns how many recipients it went to. */
export async function sendWeeklyDigest(lookbackDays = 7): Promise<{ recipients: number }> {
  const to = new Date().toISOString().slice(0, 10);
  const from = shiftDays(to, -Math.max(1, lookbackDays));

  const [report, signalsDto, anomalies] = await Promise.all([
    generateReport(from, to),
    getSmartSignals(from, to).catch(() => ({ signals: [] as Signal[] })),
    getRecentAnomalies(lookbackDays).catch(() => [] as AnomalyDTO[]),
  ]);

  const users = await listUsers();
  const recipients = users.filter((u) => u.isActive && (u.role === 'admin' || u.role === 'internal'));
  if (recipients.length === 0) {
    logger.warn('Weekly digest: no active internal/admin recipients — skipping send');
    return { recipients: 0 };
  }

  const appUrl = getServerEnv().APP_URL || 'http://localhost:3000';
  const html = digestHtml(report, signalsDto.signals, anomalies, appUrl);
  const subject = `ICE Pulse weekly digest — ${report.headline}`;

  for (const user of recipients) {
    await sendEmail({ to: user.email, subject, html });
  }

  logger.info('Weekly digest sent', { recipients: recipients.length, from, to });
  return { recipients: recipients.length };
}

export async function trySendWeeklyDigest(lookbackDays = 7): Promise<void> {
  try {
    await sendWeeklyDigest(lookbackDays);
  } catch (err) {
    logger.error('Weekly digest failed', { error: toErrorMessage(err) });
    throw err;
  }
}
