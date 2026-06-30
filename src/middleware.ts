import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    // Client-role users: redirect away from internal-only pages
    if (token?.role === 'client') {
      const slug = token.clientSlug as string | null;
      const clientRoot = slug ? `/clients/${slug}` : '/login';

      const internalPaths = ['/', '/google-ads', '/sync', '/reports', '/admin'];
      const isInternalPath = internalPaths.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (isInternalPath) {
        return NextResponse.redirect(new URL(clientRoot, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  // Protect everything except login and NextAuth API routes
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|brand).*)'],
};
