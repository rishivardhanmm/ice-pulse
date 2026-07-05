import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { disconnectZohoSocial } from '@/integrations/zoho-social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);
  if (session.user.role !== 'admin' && session.user.role !== 'internal') {
    return jsonError('Forbidden', 403);
  }
  await disconnectZohoSocial();
  return jsonOk({ ok: true });
}

