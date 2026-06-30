import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { updateTeamRole } from '@/server/db/repositories/teamRoles.repo';

export const dynamic = 'force-dynamic';

/** Updates a team role's name/approval power. Admin-only. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return jsonError('Forbidden — only admins can edit team roles.', 403);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid team role id', 400);

  const body = (await req.json().catch(() => ({}))) as { name?: string; canApprove?: boolean };
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (name !== undefined && name.length === 0) return jsonError('name cannot be empty.', 400);

  try {
    const role = await updateTeamRole(id, {
      name,
      canApprove: typeof body.canApprove === 'boolean' ? body.canApprove : undefined,
    });
    if (!role) return jsonError('Team role not found.', 404);
    return jsonOk(role);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('unique')) {
      return jsonError('A team role with that name already exists.', 409);
    }
    return jsonError(msg, 500);
  }
}
