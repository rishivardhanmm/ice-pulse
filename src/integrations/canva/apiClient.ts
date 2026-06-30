import { getCanvaConfig } from '@/server/config/env';

/**
 * Thin authenticated client for the Canva Connect REST API. Callers pass a
 * valid bearer access token (resolved/refreshed by the token service). This
 * module never stores or logs tokens.
 */

export class CanvaApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'CanvaApiError';
    this.status = status;
    this.code = code;
  }
}

export async function canvaApiFetch<T>(
  accessToken: string,
  path: string,
  init?: { method?: string; json?: unknown },
): Promise<T> {
  const cfg = getCanvaConfig();
  const url = path.startsWith('http')
    ? path
    : `${cfg.apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    accept: 'application/json',
  };
  let body: string | undefined;
  if (init?.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }

  const res = await fetch(url, { method: init?.method ?? 'GET', headers, body });
  const text = await res.text();
  if (!res.ok) {
    let code: string | undefined;
    let message = `Canva API request failed (${res.status})`;
    try {
      const j = JSON.parse(text) as { code?: string; message?: string };
      code = j.code;
      if (j.message) message = j.message;
    } catch {
      /* non-JSON error body — keep default message */
    }
    throw new CanvaApiError(res.status, message, code);
  }
  return (text ? JSON.parse(text) : {}) as T;
}
