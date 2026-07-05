import { NextResponse } from 'next/server';
import { isZohoSocialConfigured } from '@/server/config/env';
import { startZohoConnect } from '@/integrations/zoho-social';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Initiates the Zoho Social OAuth flow. Stores state in a cookie and redirects. */
export async function GET(req: Request) {
  if (!isZohoSocialConfigured()) {
    return NextResponse.redirect(new URL('/social-posts?error=not_configured', req.url));
  }
  const { url, state } = startZohoConnect();
  const res = NextResponse.redirect(url);
  res.cookies.set('zoho_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/zoho-social',
    maxAge: 600,
  });
  return res;
}

