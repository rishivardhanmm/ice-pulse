import './_env';
import http from 'node:http';
import { exec } from 'node:child_process';
import { getServerEnv } from '../src/server/config/env';

/**
 * One-off helper to obtain a Google Ads OAuth **refresh token** via the
 * loopback flow. Requires a "Desktop app" OAuth client (GOOGLE_ADS_CLIENT_ID /
 * GOOGLE_ADS_CLIENT_SECRET) set in .env.local.
 *
 *   npm run auth:google-ads
 *
 * Opens a consent screen, captures the code on http://localhost:53777, exchanges
 * it for tokens, and prints the refresh token to paste into .env.local.
 */

const SCOPE = 'https://www.googleapis.com/auth/adwords';
const PORT = 53777;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

function buildAuthUrl(clientId: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

function waitForCode(authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/oauth2callback') {
        res.writeHead(404);
        res.end();
        return;
      }
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body style="font-family:sans-serif;padding:2rem">ICE Pulse: you can close this tab and return to the terminal.</body></html>');
      server.close();
      if (err) reject(new Error(`OAuth error: ${err}`));
      else if (code) resolve(code);
      else reject(new Error('No authorization code was returned.'));
    });
    server.on('error', reject);
    server.listen(PORT, () => {
      console.log('\nOpen this URL in your browser to authorize (it should open automatically):\n');
      console.log(`${authUrl}\n`);
      exec(`start "" "${authUrl}"`, () => undefined); // best-effort auto-open on Windows
    });
  });
}

async function main(): Promise<void> {
  const env = getServerEnv();
  const clientId = env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = env.GOOGLE_ADS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in .env.local first ' +
        '(create a "Desktop app" OAuth client in Google Cloud → APIs & Services → Credentials).',
    );
  }

  const code = await waitForCode(buildAuthUrl(clientId));

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code',
  });
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await resp.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!resp.ok || !json.refresh_token) {
    throw new Error(
      `Token exchange failed: ${json.error ?? resp.status} ${json.error_description ?? ''}. ` +
        'Ensure the OAuth client is a "Desktop app" and that you approved the consent screen.',
    );
  }

  console.log('\n✅ Your Google Ads refresh token:\n');
  console.log(`${json.refresh_token}\n`);
  console.log('Paste it into .env.local as GOOGLE_ADS_REFRESH_TOKEN, then run: npm run sync:google-ads\n');
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('\n❌', e instanceof Error ? e.message : String(e), '\n');
    process.exit(1);
  });
