import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { getSubmissionDetail } from '@/server/services/approvals.service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid submission id', 400);

  try {
    const detail = await getSubmissionDetail(id, Number(session.user.id), session.user.role);
    if (!detail) return jsonError('Submission not found.', 404);
    return jsonOk(detail);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
