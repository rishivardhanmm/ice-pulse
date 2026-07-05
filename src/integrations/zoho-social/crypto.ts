import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getZohoSocialConfig } from '@/server/config/env';
import { logger } from '@/server/logger';

/** AES-256-GCM token encryption, keyed by ZOHO_SOCIAL_TOKEN_ENCRYPTION_KEY. */

const ALGO = 'aes-256-gcm';
let warnedNoKey = false;

function keyBytes(): Buffer | null {
  const k = getZohoSocialConfig().tokenEncryptionKey;
  if (!k || k.length < 16) return null;
  return createHash('sha256').update(k).digest();
}

export interface EncryptedToken {
  value: string;
  version: string;
}

export function encryptToken(plain: string): EncryptedToken {
  const key = keyBytes();
  if (!key) {
    if (!warnedNoKey) {
      logger.warn(
        'ZOHO_SOCIAL_TOKEN_ENCRYPTION_KEY is not set — Zoho tokens are NOT encrypted at rest. ' +
          'Set a 32+ char key in .env.local before production use.',
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
  if (!key) throw new Error('Cannot decrypt Zoho token: ZOHO_SOCIAL_TOKEN_ENCRYPTION_KEY is missing.');
  const [ivB64, tagB64, dataB64] = value.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted Zoho token.');
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
