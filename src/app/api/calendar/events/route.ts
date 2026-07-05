import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { isValidDateStr, defaultRange } from '@/lib/date';
import { toErrorMessage } from '@/server/logger';
import { getCalendarEvents, createCalendarEvent } from '@/server/services/calendar.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const sp = new URL(req.url).searchParams;
  const def = defaultRange(90);
  const from = isValidDateStr(sp.get('from')) ? (sp.get('from') as string) : def.from;
  const to = isValidDateStr(sp.get('to')) ? (sp.get('to') as string) : def.to;
  const clientId = sp.get('clientId') ? parseInt(sp.get('clientId')!, 10) : null;

  const events = await getCalendarEvents(from, to, clientId && Number.isFinite(clientId) ? clientId : null);
  return jsonOk({ events });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const startDate = typeof body.startDate === 'string' ? body.startDate : '';

    if (!title) return jsonError('title is required.', 400);
    if (!isValidDateStr(startDate)) return jsonError('startDate must be YYYY-MM-DD.', 400);

    const endDate =
      typeof body.endDate === 'string' && isValidDateStr(body.endDate) ? body.endDate : null;
    const clientId =
      body.clientId != null && body.clientId !== '' ? Number(body.clientId) : null;
    const color = typeof body.color === 'string' ? body.color.slice(0, 20) : null;
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null;

    const id = await createCalendarEvent(
      { title, startDate, endDate, clientId: clientId && Number.isFinite(clientId) ? clientId : null, color, notes },
      Number(session.user.id),
    );
    return jsonOk({ id }, 201);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
