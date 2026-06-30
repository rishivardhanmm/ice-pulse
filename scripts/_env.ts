/**
 * Loads environment files for standalone scripts (tsx).
 *
 * Import this FIRST in every script (`import './_env';`) so that
 * `.env.local` / `.env` are loaded into process.env before any module reads
 * configuration. Next.js loads these automatically for the app itself, so this
 * helper is only needed for CLI scripts.
 *
 * `.env.local` wins because dotenv does not override already-set variables.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    loadEnv({ path });
  }
}
