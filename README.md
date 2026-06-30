# ICE Pulse

**Internal marketing intelligence dashboard for ICE Creates.**

ICE Pulse pulls **Google Ads** campaign performance via the API, stores it in a local
**Microsoft SQL Server** database, and presents it in a polished internal dashboard. It is built
as the foundation of a wider marketing-intelligence hub — Meta, Zoho, Canva, Power BI, AI insights,
approvals and client portals are scaffolded as clearly-marked future modules but are **not** built yet.

> Phase 1 scope: Google Ads sync → MSSQL → dashboard. Nothing else is faked.

---

## Tech stack

| Layer       | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Framework   | Next.js 14 (App Router) + React 18 + TypeScript (one app, UI + API) |
| Styling     | Tailwind CSS + CSS-variable themes (dark / light / calm)          |
| Charts      | Recharts                                                          |
| Icons/Fonts | Bootstrap Icons · self-hosted Albra + Poppins (ICE brand kit)     |
| Database    | Microsoft SQL Server via `mssql`                                  |
| Google Ads  | `google-ads-api` (GAQL), wrapped behind a `DataConnector`         |
| Validation  | `zod`                                                             |

The visual language (palette, fonts, components) is taken from the ICE design system, so the app
matches ICE Creates branding rather than a generic admin theme.

---

## Prerequisites

- **Node.js 18.18+** — validated on **Node 24 (LTS)**; the repo's `.nvmrc` pins Node 24 (`nvm use`). And npm.
- **Microsoft SQL Server** reachable from your machine or hosting provider, with a database you can connect to (default name `IcePulse`)
- **Google Ads API credentials** (developer token, OAuth client id/secret, refresh token, customer id)

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local        # then edit .env.local with your real values
#   (Windows PowerShell: Copy-Item .env.example .env.local)

# 3. Create the schema in MSSQL (safe to re-run)
npm run db:migrate

# 4. Seed bootstrap rows (default client + roadmap placeholders — no fake metrics)
npm run db:seed

# 5. Pull Google Ads data into MSSQL (last 30 days by default)
npm run sync:google-ads
#   custom range:
npm run sync:google-ads -- --from=2026-06-01 --to=2026-06-16

# 6. Run the dashboard
npm run dev
# open http://localhost:3000
```

You can also trigger a sync from the UI: **Sync Centre → Run Google Ads sync**.

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in real values. `.env.local` is gitignored — **never
commit real secrets**. Secrets are never printed to logs.

| Variable | Purpose |
| --- | --- |
| `MSSQL_AUTH` | `windows` (Integrated Security — uses `msnodesqlv8` + an ODBC driver) or `sql` (username/password — uses `tedious`). |
| `MSSQL_SERVER`, `MSSQL_INSTANCE`, `MSSQL_PORT` | Host details. For a hosted fixed-port server, set `MSSQL_SERVER=176.74.16.213`, `MSSQL_PORT=1433`, and leave `MSSQL_INSTANCE` blank. Use `MSSQL_INSTANCE` only for named-instance resolution through SQL Browser. |
| `MSSQL_DATABASE` | Database name (default `IcePulse`). Created automatically by `db:migrate` if missing. |
| `MSSQL_USER`, `MSSQL_PASSWORD` | Only used when `MSSQL_AUTH=sql`. |
| `MSSQL_ODBC_DRIVER` | Windows-auth ODBC driver name (default `ODBC Driver 18 for SQL Server`; set to 17 if only that is installed). |
| `MSSQL_ENCRYPT`, `MSSQL_TRUST_SERVER_CERTIFICATE` | TLS options. Local default: `true` / `true`. |
| `MSSQL_CONNECTION_TIMEOUT_MS`, `MSSQL_REQUEST_TIMEOUT_MS` | Connection/query timeouts. `MSSQL_REQUEST_TIMEOUT_MS=0` disables query timeout, matching SSMS "Command Timeout=0". |
| `MSSQL_APP_NAME` | Application name shown to SQL Server (default `ICE Pulse`). |
| `GOOGLE_ADS_AUTH` | `oauth` (refresh token) or `service_account` (Workspace domain-wide delegation). |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token (both modes). |
| `GOOGLE_ADS_CUSTOMER_ID` | Target account id, digits only (both modes). |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional — manager (MCC) account id, digits only. |
| `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` | OAuth mode only. |
| `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE`, `GOOGLE_ADS_IMPERSONATION_EMAIL` | Service-account mode only: JSON key path + the Workspace user to impersonate. |
| `GOOGLE_ADS_API_VERSION` | API version label (default `v24`). |
| `AI_ENABLED` | `true` to enable the AI features (insights, Ask-Pulse chat, per-campaign analysis). |
| `OPENAI_API_KEY` | OpenAI API key. AI features stay hidden until this is set. |
| `OPENAI_MODEL` | Model (default `gpt-4o-mini`). |
| `AI_INPUT_PRICE_PER_1M`, `AI_OUTPUT_PRICE_PER_1M` | USD per 1M tokens, used to estimate cost (gpt-4o-mini: 0.15 / 0.60). |
| `AI_MAX_OUTPUT_TOKENS` | Output cap per AI call (default 500). |

---

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dashboard + API at http://localhost:3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (Next.js config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply `database/migrations/*.sql` (tracked, idempotent) |
| `npm run db:seed` | Apply `database/seeds/*.sql` (idempotent MERGE) |
| `npm run sync:google-ads` | Pull Google Ads data into MSSQL (`-- --from= --to=`) |
| `npm run auth:google-ads` | Generate a Google Ads OAuth refresh token (loopback flow) |

---

## How it works

```
Google Ads API ──(npm run sync:google-ads / POST /api/sync/google-ads)──▶ MSSQL
                                                                            │
Dashboard (Next.js pages) ──▶ /api/* route handlers ──▶ repositories ──────┘
```

The dashboard **never calls Google Ads on page load** — it only reads from MSSQL. Data is refreshed
by running a sync (CLI or the Sync Centre button). Syncs upsert on `(campaign, date)`, so they are
safe to run repeatedly without duplicating rows, and every run is recorded in `sync_runs`.

See [`docs/architecture.md`](docs/architecture.md) for the full data flow, schema and sync details,
and [`docs/roadmap.md`](docs/roadmap.md) for the phased plan.

---

## Project structure

```
src/
  app/                 Next.js routes — pages + /api route handlers
  components/          UI: layout shell, charts, dashboard/google-ads/sync/roadmap widgets
  lib/                 Shared types, formatters, date helpers, client data hook
  server/
    config/env.ts      zod-validated env (secret-safe)
    db/                MSSQL pool + repositories
    services/          dashboard aggregation + deterministic insights
    api/http.ts        JSON response + query helpers
  integrations/
    connector.ts       DataConnector contract
    google-ads/        REAL implementation
    {meta,zoho,canva,power-bi,company-results}/   placeholders (READMEs only)
    ../ai/             placeholder for the future AI layer
database/              migrations, seeds, consolidated schema.sql
scripts/               migrate / seed / sync-google-ads CLIs
docs/                  architecture, setup, roadmap
assets/                ICE brand kit (fonts, logos, icons) — source of truth, not modified
public/                curated copies of fonts + ICE logos used by the app
```

---

## Notes & limitations

- The dashboard reads from MSSQL only. Run a sync to populate it; until then you'll see clear empty
  states and a "configure Google Ads" notice.
- Adding a new data source = add a folder under `src/integrations/` implementing `DataConnector`,
  plus its tables/repositories/routes. The external **company results database** schema is unknown
  and intentionally **not** implemented — only a documented placeholder exists.
- Triggering a sync from the UI runs the full pull server-side and may take several seconds for large
  date ranges; the button shows a loading state and reports the result.
