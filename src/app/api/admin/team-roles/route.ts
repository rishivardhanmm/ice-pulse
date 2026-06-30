import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { listTeamRoles, createTeamRole } from '@/server/db/repositories/teamRoles.repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const roles = await listTeamRoles();
  return jsonOk(roles);
}

/** Creates a team role. Admin-only — granting approval power is sensitive. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return jsonError('Forbidden — only admins can create team roles.', 403);
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string; canApprove?: boolean };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return jsonError('name is required.', 400);
  if (name.length > 100) return jsonError('name must be 100 characters or fewer.', 400);

  const canApprove = body.canApprove === true;

  try {
    const role = await createTeamRole({ name, canApprove });
    return jsonOk(role);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UQ_team_roles_name') || msg.toLowerCase().includes('unique')) {
      return jsonError('A team role with that name already exists.', 409);
    }
    return jsonError(msg, 500);
  }
}
