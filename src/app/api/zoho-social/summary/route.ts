import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { getSocialSummary } from '@/server/services/zoho-social.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);
  const days = Number(new URL(req.url).searchParams.get('days') ?? '30');
  const summary = await getSocialSummary(isNaN(days) ? 30 : days);
  return jsonOk(summary);
}

