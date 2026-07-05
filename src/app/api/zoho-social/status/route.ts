import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { getZohoSocialStatus } from '@/integrations/zoho-social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);
  const status = await getZohoSocialStatus();
  return jsonOk(status);
}

