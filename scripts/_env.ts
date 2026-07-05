/**
 * Loads environment files for standalone scripts (tsx).
 *
 * Import this FIRST in every script (`import './_env';`) so that env files are
 * loaded into process.env before any module reads configuration. Next.js loads
 * these automatically for the app itself, so this helper is only needed for
 * CLI scripts — and mirrors Next's own precedence order so a script run on a
 * dev machine and `next dev` agree on which database etc. they talk to:
 *
 *   .env.[NODE_ENV].local  (e.g. .env.development.local — dev-only overrides)
 *   .env.local
 *   .env
 *
 * dotenv does not override a variable that's already set, so earlier files in
 * this list win. NODE_ENV defaults to 'development' here (unlike Next.js,
 * these scripts have no framework setting it) since that's what a developer
 * running them by hand on their own machine wants; set NODE_ENV=production
 * explicitly to target the hosted server config instead.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const nodeEnv = process.env.NODE_ENV ?? 'development';

for (const file of [`.env.${nodeEnv}.local`, '.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    loadEnv({ path });
  }
}
