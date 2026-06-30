import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { findUserByEmail } from '@/server/db/repositories/users.repo';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8-hour sessions
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await findUserByEmail(credentials.email).catch(() => null);
        if (!user || !user.isActive) return null;
        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientId,
          clientSlug: user.clientSlug,
          clientName: user.clientName,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as PulseUser).role;
        token.clientId = (user as PulseUser).clientId;
        token.clientSlug = (user as PulseUser).clientSlug;
        token.clientName = (user as PulseUser).clientName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as PulseRole;
        session.user.clientId = token.clientId as number | null;
        session.user.clientSlug = token.clientSlug as string | null;
        session.user.clientName = token.clientName as string | null;
      }
      return session;
    },
  },
};

export type PulseRole = 'admin' | 'internal' | 'client';

interface PulseUser {
  id: string;
  email: string;
  name: string;
  role: PulseRole;
  clientId: number | null;
  clientSlug: string | null;
  clientName: string | null;
}
