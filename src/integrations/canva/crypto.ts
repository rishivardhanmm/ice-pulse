import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getCanvaConfig } from '@/server/config/env';
import { logger } from '@/server/logger';

/**
 * Token-at-rest encryption, isolated behind this module so the storage scheme
 * can evolve without touching callers (token service / repo).
 *
 * Uses AES-256-GCM keyed by CANVA_TOKEN_ENCRYPTION_KEY (hashed to 32 bytes).
 * If no key is configured, tokens are stored base64-obfuscated and tagged
 * "plain" with a loud one-time warning — this is acceptable for local draft
 * testing only. TODO: require a real key before any production use.
 *
 * NEVER log token plaintext or ciphertext.
 */

const ALGO = 'aes-256-gcm';
let warnedNoKey = false;

function keyBytes(): Buffer | null {
  const k = getCanvaConfig().tokenEncryptionKey;
  if (!k || k.length < 16) return null;
  return createHash('sha256').update(k).digest(); // 32 bytes
}

export interface EncryptedToken {
  value: string;
  version: string; // 'v1' (AES-GCM) | 'plain' (base64, NOT encrypted)
}

export function encryptToken(plain: string): EncryptedToken {
  const key = keyBytes();
  if (!key) {
    if (!warnedNoKey) {
      logger.warn(
        'CANVA_TOKEN_ENCRYPTION_KEY is not set — Canva tokens are NOT encrypted at rest. ' +
          'Set a 32+ char key in .env.local before any real use.',
      );
      warnedNoKey = true;
    }
    return { value: Buffer.from(plain, 'utf8').toString('base64'), version: 'plain' };
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    value: `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`,
    version: 'v1',
  };
}

export function decryptToken(value: string, version: string): string {
  if (version === 'plain') return Buffer.from(value, 'base64').toString('utf8');
  const key = keyBytes();
  if (!key) {
    throw new Error('Cannot decrypt Canva token: CANVA_TOKEN_ENCRYPTION_KEY is missing.');
  }
  const [ivB64, tagB64, dataB64] = value.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted Canva token.');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}
