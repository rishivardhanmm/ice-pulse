import { defaultRange, isValidDateStr } from '../../lib/date';

/** JSON success response with no caching (dashboard data is always fresh from MSSQL). */
export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function jsonError(
  message: string,
  status = 500,
  extra?: Record<string, unknown>,
): Response {
  return jsonOk({ error: message, ...(extra ?? {}) }, status);
}

/** Parse ?from=&to= with validation and a sensible default; orders the pair. */
export function parseDateRange(
  searchParams: URLSearchParams,
  days = 30,
): { from: string; to: string } {
  const def = defaultRange(days);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const from = isValidDateStr(fromParam) ? (fromParam as string) : def.from;
  const to = isValidDateStr(toParam) ? (toParam as string) : def.to;
  return from > to ? { from: to, to: from } : { from, to };
}
