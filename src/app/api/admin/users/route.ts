import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { listUsers, createUser, setUserActive } from '@/server/db/repositories/users.repo';
import { hash } from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }
  const users = await listUsers();
  // Never expose password hashes to the frontend
  return jsonOk(users.map(({ passwordHash: _, ...u }) => u));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const body = await req.json().catch(() => ({})) as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    clientId?: number | null;
    teamRoleId?: number | null;
  };

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = (['admin', 'internal', 'client'] as string[]).includes(body.role ?? '')
    ? (body.role as 'admin' | 'internal' | 'client')
    : 'internal';

  if (!email || !password || !name) return jsonError('email, password and name are required.', 400);
  if (password.length < 8) return jsonError('Password must be at least 8 characters.', 400);
  if (role === 'client' && !body.clientId) return jsonError('clientId required for client role.', 400);

  const passwordHash = await hash(password, 12);
  const user = await createUser({
    email,
    passwordHash,
    name,
    role,
    clientId: typeof body.clientId === 'number' ? body.clientId : null,
    teamRoleId: role !== 'client' && typeof body.teamRoleId === 'number' ? body.teamRoleId : null,
  });

  const { passwordHash: _, ...safe } = user;
  return jsonOk(safe);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const body = await req.json().catch(() => ({})) as { id?: number; isActive?: boolean };
  if (typeof body.id !== 'number') return jsonError('id required', 400);
  if (typeof body.isActive !== 'boolean') return jsonError('isActive required', 400);

  await setUserActive(body.id, body.isActive);
  return jsonOk({ ok: true });
}
