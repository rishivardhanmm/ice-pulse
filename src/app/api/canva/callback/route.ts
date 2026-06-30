import { NextResponse, type NextRequest } from 'next/server';
import { completeOAuth } from '@/integrations/canva';
import { logger, toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * OAuth callback: validates state (anti-CSRF) against the cookie, exchanges the
 * code for tokens, then redirects back to the Canva settings page. The PKCE
 * cookies are always cleared.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const cookieState = req.cookies.get('canva_oauth_state')?.value;
  const verifier = req.cookies.get('canva_oauth_verifier')?.value;

  const redirectTo = (query: string) => {
    const res = NextResponse.redirect(new URL(`/canva${query}`, req.url));
    res.cookies.set('canva_oauth_state', '', { path: '/api/canva', maxAge: 0 });
    res.cookies.set('canva_oauth_verifier', '', { path: '/api/canva', maxAge: 0 });
    return res;
  };

  if (oauthError) return redirectTo(`?error=${encodeURIComponent(oauthError)}`);
  if (!code || !state || !cookieState || !verifier || state !== cookieState) {
    return redirectTo('?error=invalid_state');
  }

  try {
    await completeOAuth(code, verifier);
    return redirectTo('?connected=1');
  } catch (err) {
    logger.error('Canva OAuth callback failed', { error: toErrorMessage(err) });
    return redirectTo('?error=connect_failed');
  }
}
