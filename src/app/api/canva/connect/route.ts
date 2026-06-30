import { NextResponse } from 'next/server';
import { getCanvaConfig, isCanvaConfigured } from '@/server/config/env';
import { startConnect } from '@/integrations/canva';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starts the Canva OAuth flow: stashes the PKCE verifier + state in short-lived
 * httpOnly cookies and redirects the browser to Canva's consent screen.
 */
export async function GET(req: Request) {
  if (!isCanvaConfigured()) {
    return NextResponse.redirect(new URL('/canva?error=not_configured', req.url));
  }

  // The state/PKCE cookies must be set on the SAME host the callback runs on.
  // If the user started on a different host than the registered redirect URI
  // (the classic localhost vs 127.0.0.1 mismatch → "invalid state"), bounce once
  // to the redirect URI's host first so the cookies and callback line up.
  const cfg = getCanvaConfig();
  const reqUrl = new URL(req.url);
  const redirectHost = new URL(cfg.redirectUri).host;
  if (reqUrl.host !== redirectHost && reqUrl.searchParams.get('hostfix') !== '1') {
    const fixed = new URL(cfg.redirectUri);
    fixed.pathname = '/api/canva/connect';
    fixed.search = 'hostfix=1';
    return NextResponse.redirect(fixed.toString());
  }

  const { url, state, codeVerifier } = startConnect();
  const res = NextResponse.redirect(url);
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/canva',
    maxAge: 600,
  };
  res.cookies.set('canva_oauth_state', state, opts);
  res.cookies.set('canva_oauth_verifier', codeVerifier, opts);
  return res;
}
