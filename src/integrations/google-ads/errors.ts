import { toErrorMessage } from '../../server/logger';

interface GaErrorItem {
  message?: string;
  error_code?: Record<string, unknown>;
}

interface GaErrorLike {
  errors?: GaErrorItem[];
  message?: string;
}

function extractMessage(err: unknown): string {
  const e = err as GaErrorLike | null;
  if (e && Array.isArray(e.errors) && e.errors.length > 0) {
    const parts = e.errors
      .map((item) => {
        const code = item.error_code ? Object.values(item.error_code)[0] : undefined;
        const msg = item.message ?? '';
        return code ? `${msg} (${String(code)})` : msg;
      })
      .filter((s) => s.length > 0);
    if (parts.length > 0) return parts.join('; ');
  }
  return toErrorMessage(err);
}

/**
 * Turns a raw Google Ads error into an actionable message. Never includes
 * credential values — only references the env var names to check.
 */
export function friendlyGoogleAdsError(err: unknown): string {
  const message = extractMessage(err);
  const m = message.toLowerCase();
  const hints: string[] = [];

  if (m.includes('invalid_grant') || m.includes('refresh token')) {
    hints.push('GOOGLE_ADS_REFRESH_TOKEN may be expired or invalid — regenerate it.');
  }
  if (m.includes('permission_denied') || m.includes('does not have permission')) {
    hints.push(
      'Confirm the account has access. If using a manager (MCC) account, set GOOGLE_ADS_LOGIN_CUSTOMER_ID.',
    );
  }
  if (m.includes('developer token') || m.includes('developer_token')) {
    hints.push('Verify GOOGLE_ADS_DEVELOPER_TOKEN and that it is approved for this account.');
  }
  if (m.includes('not found') || m.includes('invalid customer')) {
    hints.push('Verify GOOGLE_ADS_CUSTOMER_ID (digits only, no dashes).');
  }

  return hints.length > 0 ? `${message} — ${hints.join(' ')}` : message;
}
