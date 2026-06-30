import type { PulseRole } from '@/lib/auth';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: PulseRole;
      clientId: number | null;
      clientSlug: string | null;
      clientName: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: PulseRole;
    clientId: number | null;
    clientSlug: string | null;
    clientName: string | null;
  }
}
