import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { listApprovers } from '@/server/db/repositories/users.repo';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** People who can be asked to review a submission (everyone with approval power, minus the caller). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  try {
    const approvers = await listApprovers(Number(session.user.id));
    return jsonOk({ approvers: approvers.map((a) => ({ id: a.id, name: a.name })) });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
