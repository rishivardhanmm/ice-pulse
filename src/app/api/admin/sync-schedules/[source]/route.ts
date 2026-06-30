import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { updateSchedule } from '@/server/db/repositories/syncSchedules.repo';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { source: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    intervalMinutes?: number;
    lookbackDays?: number;
  };

  if (body.intervalMinutes !== undefined && (!Number.isFinite(body.intervalMinutes) || body.intervalMinutes < 1)) {
    return jsonError('intervalMinutes must be a positive number.', 400);
  }
  if (body.lookbackDays !== undefined && (!Number.isFinite(body.lookbackDays) || body.lookbackDays < 1)) {
    return jsonError('lookbackDays must be a positive number.', 400);
  }

  const updated = await updateSchedule(params.source, body);
  if (!updated) return jsonError('Schedule not found.', 404);
  return jsonOk(updated);
}
