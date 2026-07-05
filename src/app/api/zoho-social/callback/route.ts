import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { completeZohoOAuth } from '@/integrations/zoho-social';
import { logger, toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const cookieState = req.cookies.get('zoho_oauth_state')?.value;

  const redirectTo = (query: string) => {
    const res = NextResponse.redirect(new URL(`/social-posts${query}`, req.url));
    res.cookies.set('zoho_oauth_state', '', { path: '/api/zoho-social', maxAge: 0 });
    return res;
  };

  if (oauthError) return redirectTo(`?error=${encodeURIComponent(oauthError)}`);
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo('?error=invalid_state');
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return redirectTo('?error=not_authenticated');

  try {
    await completeZohoOAuth(code, Number(session.user.id));
    return redirectTo('?connected=1');
  } catch (err) {
    logger.error('Zoho Social OAuth callback failed', { error: toErrorMessage(err) });
    return redirectTo('?error=connect_failed');
  }
}

