import { createHash, randomBytes } from 'node:crypto';

/**
 * PKCE + state helpers for the Canva Connect OAuth flow.
 *
 * Canva requires the Authorization Code flow with PKCE (SHA-256). The verifier
 * is generated when building the authorize URL, kept server-side (in a
 * short-lived httpOnly cookie), and replayed at the token exchange.
 * Docs: https://www.canva.dev/docs/connect/authentication/
 */

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 code verifier (43–128 chars). */
export function createCodeVerifier(): string {
  return base64url(randomBytes(64));
}

/** S256 code challenge derived from the verifier. */
export function codeChallengeFor(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

/** Opaque anti-CSRF state value. */
export function createState(): string {
  return base64url(randomBytes(24));
}
