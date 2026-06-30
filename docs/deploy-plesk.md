# Deploying ICE Pulse to Plesk

ICE Pulse is a **Node.js (Next.js) server app** — it has API routes, server rendering and live MSSQL
queries, so it must run as a Node application (Plesk's **Node.js** extension), not as static hosting.

## 0. Decide first: Windows Plesk vs Linux Plesk

This matters because of the database driver:

| | Windows Plesk (IIS + iisnode) | Linux Plesk (nginx/Apache + Passenger) |
| --- | --- | --- |
| DB auth | Can keep **Windows auth** (`MSSQL_AUTH=windows`, native `msnodesqlv8`) **or** SQL auth | **SQL auth only** (`MSSQL_AUTH=sql`, pure-JS `tedious`) |
| Native module | `msnodesqlv8` needs **ODBC Driver 18 for SQL Server** installed on the server | `msnodesqlv8` is hard to build — use SQL auth and treat it as optional* |
| Recommended | ✅ Best fit for this MSSQL stack | Fine if SQL Server accepts a SQL login over the network |

\* On Linux, `msnodesqlv8` is only imported when `MSSQL_AUTH=windows` (see `pool.ts`), so with SQL auth
it's never used at runtime. If `npm ci` fails building it on Linux, move `"msnodesqlv8"` from
`dependencies` to `optionalDependencies` in `package.json` (ask and I'll do it) and reinstall.

## 1. Server prerequisites (in Plesk)

- **Node.js 24** available: Plesk → *Tools & Settings → Updates → Add Components → Node.js* (or the
  Node.js site extension). The repo pins Node 24 via `.nvmrc`.
- **SQL Server** reachable from the Plesk box, with a database (e.g. `IcePulse`) and either a SQL login
  (recommended for hosting) or a Windows service account with access.
- Windows + Windows auth only: install **ODBC Driver 18 for SQL Server** on the server.
- A **domain/subdomain** in Plesk (e.g. `pulse.icecreates.com`) and **SSL** (Let's Encrypt via *SSL It!*).

## 2. Get the code onto the server

Use Plesk **Git** (recommended) or upload a zip. Do **not** ship `node_modules`, `.next`, or
`.env.local` — build and configure on the server. (`.gitignore` already excludes them.)

## 3. Configure the Node.js app (Plesk → Websites & Domains → your domain → Node.js)

1. **Application Root**: the folder containing `package.json`.
2. **Application Startup File**: `app.js` (a custom Next.js production server that runs the built app
   on `process.env.PORT`; `app.js` is Plesk's default startup filename). Verified booting on Node 24.
3. **Application Mode**: `production` (this sets `NODE_ENV=production`).
4. **Node version**: 24.
5. **NPM install**: click it (or SSH: `npm ci`).
6. **Environment variables** (Custom environment variables): add the production values — see §4.
7. **Build**: in the Node.js panel use *Run script → `build`* (or SSH: `npm run build`). Required
   before first start, and after every deploy. (If you start without building you'll get
   "Could not find a production build in the '.next' directory".)
8. **Migrate the database**: *Run script → `db:migrate`* (or SSH: `npm run db:migrate`) to create the
   tables in the production DB. Optionally `db:seed`.
9. **Restart App** (also restart after any env-var change).

Plesk + Passenger/iisnode handle the port, reverse proxy and `web.config` automatically — `app.js`
listens on `process.env.PORT`, so don't hardcode a port.

## 4. Production environment variables

Set these in Plesk (or a server-only `.env.production.local`). Use `.env.example` as the reference.
Production-specific values to change vs local:

- `APP_URL=https://your-domain` (e.g. `https://pulse.icecreates.com`)
- **MSSQL** — point at the prod DB. For hosting, prefer SQL auth:
  `MSSQL_AUTH=sql`, `MSSQL_SERVER=...`, `MSSQL_DATABASE=IcePulse`, `MSSQL_USER=...`,
  `MSSQL_PASSWORD=...`, `MSSQL_ENCRYPT=true`, `MSSQL_TRUST_SERVER_CERTIFICATE` per your cert.
- **Google Ads**: `GOOGLE_ADS_*` as in `.env.example`. For service-account mode, set
  `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64` (base64 of the whole key JSON, generated locally with
  `node -e "console.log(require('fs').readFileSync('key.json').toString('base64'))"`) rather than
  `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE` — it's just an env var like every other secret here, with no
  file to place on the server and no NTFS/app-pool permissions to configure.
- **AI**: `AI_ENABLED=true`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.
- **Canva**: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, and crucially
  `CANVA_REDIRECT_URI=https://your-domain/api/canva/callback`. Generate a **fresh**
  `CANVA_TOKEN_ENCRYPTION_KEY` for production (don't reuse the dev one).

Never commit secrets. Plesk's env-var UI keeps them out of the repo.

## 5. Canva (if using the integration)

In the Canva developer portal, add the production redirect URL **exactly**:
`https://your-domain/api/canva/callback`, and keep the same enabled scopes. Then reconnect from
`/canva` on the live site.

## 6. After deploy — checklist

- Visit `https://your-domain` → dashboard loads.
- `https://your-domain/api/health` (or the dashboard data) confirms the DB connection.
- HTTPS padlock (Let's Encrypt) is active; `APP_URL` matches.
- Re-deploy flow: `git pull` → `npm ci` → `npm run build` → restart app.

## Common gotchas

- **Build before start** (and after every deploy) — the #1 cause of a failed boot.
- **Don't run `next dev`** on the server; it replaces the production `.next`.
- **Env changes require an app restart** in Plesk.
- **Low RAM build**: if `next build` is killed, set `NODE_OPTIONS=--max-old-space-size=2048`.
- **Windows auth under iisnode** needs the IIS/app-pool identity to have SQL access — SQL auth avoids
  this entirely and is the simpler hosting choice.
- **Avoid file-path secrets on Windows hosting** (e.g. `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE`) —
  the IIS application-pool identity often can't read folders outside the site's own directory tree,
  which throws a confusing `ENOENT` even when the file genuinely exists. Prefer the `_BASE64`
  env-var form of any such credential where one exists.
