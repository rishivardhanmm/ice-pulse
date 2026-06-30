import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { decide, ApprovalError } from '@/server/services/approvals.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid submission id', 400);

  const body = (await req.json().catch(() => ({}))) as { decision?: string; comment?: string };
  const decision = body.decision === 'approved' || body.decision === 'rejected' ? body.decision : null;
  if (!decision) return jsonError('decision must be "approved" or "rejected".', 400);

  try {
    await decide(
      id,
      Number(session.user.id),
      session.user.role,
      session.user.name,
      decision,
      typeof body.comment === 'string' ? body.comment : null,
    );
    return jsonOk({ ok: true });
  } catch (err) {
    if (err instanceof ApprovalError) return jsonError(err.message, err.status);
    return jsonError(toErrorMessage(err), 500);
  }
}
