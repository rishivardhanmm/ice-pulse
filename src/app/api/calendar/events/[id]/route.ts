import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { deleteCalendarEvent } from '@/server/services/calendar.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const rawId = params.id.replace(/^manual-/, '');
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid id.', 400);

  try {
    await deleteCalendarEvent(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
