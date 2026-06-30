/**
 * deploy.ts - Build and upload the built app via FTPS.
 *
 * Usage:
 *   npm run deploy
 *
 * Reads credentials from .env.deploy (never committed - see .env.deploy.example).
 * Required vars: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASSWORD, DEPLOY_SFTP_PATH
 * Optional vars: DEPLOY_PORT (default 21), DEPLOY_TLS_SERVERNAME
 *
 * FTPS cannot execute commands on the server, so this script uploads the built
 * app contents directly. Restart the Node app from Plesk after upload.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { Client as FtpClient } from 'basic-ftp';

dotenv.config({ path: path.join(process.cwd(), '.env.deploy') });

const REQUIRED = ['DEPLOY_HOST', 'DEPLOY_USER', 'DEPLOY_PASSWORD', 'DEPLOY_SFTP_PATH'] as const;
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`\nX  Missing ${key} in .env.deploy\n`);
    process.exit(1);
  }
}

const CONFIG = {
  host: process.env.DEPLOY_HOST!,
  port: parseInt(process.env.DEPLOY_PORT ?? '21', 10),
  username: process.env.DEPLOY_USER!,
  password: process.env.DEPLOY_PASSWORD!,
  remotePath: process.env.DEPLOY_SFTP_PATH!.replace(/\\/g, '/').replace(/\/+$/, ''),
  tlsServername: process.env.DEPLOY_TLS_SERVERNAME,
};

const ROOT = path.join(__dirname, '..');
const RECONNECT_EVERY_FILES = 75;

const INCLUDE_DIRS = ['.next', 'public', 'database', 'scripts'];
const INCLUDE_FILES = [
  'package.json',
  'package-lock.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'app.js',
  'web.config',
  // Production-only secrets/overrides not set in Plesk's env-var panel. Never
  // committed (gitignored) — app.js loads it automatically via @next/env.
  '.env.production.local',
];

function step(msg: string) { console.log(`\n>  ${msg}`); }
function ok(msg: string) { console.log(`   OK  ${msg}`); }
function run(cmd: string, cwd = ROOT) { execSync(cmd, { cwd, stdio: 'inherit' }); }

function doBuild() {
  step('Building Next.js app...');
  run('npm run build');
  ok('Build complete');
}

function shouldSkip(localPath: string) {
  const relative = path.relative(ROOT, localPath).replace(/\\/g, '/');
  return relative === '.next/cache' || relative.startsWith('.next/cache/');
}

function listLocalFiles(targetPath: string): string[] {
  if (!fs.existsSync(targetPath) || shouldSkip(targetPath)) return [];

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];

  const files: string[] = [];
  for (const entry of fs.readdirSync(targetPath)) {
    files.push(...listLocalFiles(path.join(targetPath, entry)));
  }
  return files;
}

function getUploadFiles() {
  const files = [
    ...INCLUDE_DIRS.flatMap((dir) => listLocalFiles(path.join(ROOT, dir))),
    ...INCLUDE_FILES.flatMap((file) => listLocalFiles(path.join(ROOT, file))),
  ];

  return files.map((localPath) => ({
    localPath,
    relativePath: path.relative(ROOT, localPath).replace(/\\/g, '/'),
    size: fs.statSync(localPath).size,
  }));
}

function remoteJoin(...parts: string[]) {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');
}

async function connectClient() {
  const client = new FtpClient(60_000);
  client.ftp.verbose = false;

  await client.access({
    host: CONFIG.host,
    port: CONFIG.port,
    user: CONFIG.username,
    password: CONFIG.password,
    secure: true,
    secureOptions: CONFIG.tlsServername ? { servername: CONFIG.tlsServername } : undefined,
  });

  return client;
}

async function uploadOneFile(client: FtpClient, file: { localPath: string; relativePath: string; size: number }) {
  const remotePath = remoteJoin(CONFIG.remotePath, file.relativePath);
  const remoteDir = remotePath.split('/').slice(0, -1).join('/');

  await client.ensureDir(remoteDir);
  await client.uploadFrom(file.localPath, remotePath);
}

async function doUpload(): Promise<void> {
  const files = getUploadFiles();
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  let uploadedBytes = 0;
  let uploadedFiles = 0;
  let client: FtpClient | undefined;

  const logProgress = (fileName: string) => {
    const pct = totalBytes > 0 ? Math.floor((uploadedBytes / totalBytes) * 100) : 100;
    process.stdout.write(`\r   ${pct}%  (${(uploadedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)  ${fileName}`);
  };

  const reconnect = async (reason?: string) => {
    if (client) client.close();
    if (reason) {
      process.stdout.write('\n');
      step(reason);
    }
    client = await connectClient();
    await client.ensureDir(CONFIG.remotePath);
  };

  try {
    step(`Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username} using explicit FTPS...`);
    if (CONFIG.tlsServername) {
      ok(`Using TLS server name ${CONFIG.tlsServername}`);
    }
    await reconnect();
    ok('FTPS connection established');

    step(`Uploading ${files.length} files to ${CONFIG.remotePath}...`);
    for (const file of files) {
      if (uploadedFiles > 0 && uploadedFiles % RECONNECT_EVERY_FILES === 0) {
        await reconnect(`Refreshing FTPS connection after ${uploadedFiles} files...`);
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await uploadOneFile(client!, file);
          uploadedBytes += file.size;
          uploadedFiles += 1;
          logProgress(file.relativePath);
          break;
        } catch (err) {
          if (attempt === 3) throw err;
          await reconnect(`Connection dropped while uploading ${file.relativePath}; retrying (${attempt + 1}/3)...`);
        }
      }
    }

    process.stdout.write('\n');
    ok('FTPS upload complete');
  } finally {
    if (client) client.close();
  }
}

async function main() {
  doBuild();
  await doUpload();

  console.log(`\nOK  Uploaded app files successfully to ${CONFIG.host}:${CONFIG.remotePath}\n`);
  console.log('Next step: restart the Node.js app in Plesk. FTPS cannot restart it automatically.\n');
}

main().catch((err: unknown) => {
  console.error('\nX  Deploy failed:', err);
  process.exit(1);
});
