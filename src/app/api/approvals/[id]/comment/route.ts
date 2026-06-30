import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { addComment, ApprovalError } from '@/server/services/approvals.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid submission id', 400);

  const body = (await req.json().catch(() => ({}))) as { comment?: string };
  const comment = typeof body.comment === 'string' ? body.comment : '';

  try {
    await addComment(id, Number(session.user.id), comment);
    return jsonOk({ ok: true });
  } catch (err) {
    if (err instanceof ApprovalError) return jsonError(err.message, err.status);
    return jsonError(toErrorMessage(err), 500);
  }
}
