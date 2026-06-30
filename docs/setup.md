# ICE Pulse — Setup

Step-by-step local setup for Windows (the commands also work on macOS/Linux).

## 1. Install Node.js

Install **Node.js 18.18+** — **Node 24 (LTS) is recommended and validated**; the repo's `.nvmrc`
pins Node 24 (run `nvm use`). Get it from <https://nodejs.org>. Verify:

```bash
node -v
npm -v
```

## 2. Microsoft SQL Server

You need a reachable SQL Server instance and a database.

1. Ensure SQL Server is reachable from the machine running the app.
2. Create the database (once):

   ```sql
   CREATE DATABASE IcePulse;
   ```

3. Make sure you have a SQL login with access, or note your instance for Windows auth setups.
   This project uses **SQL authentication** (username/password) by default.

> Hosted/fixed-port SQL Server? Use the host/IP in `MSSQL_SERVER`, the TCP port in `MSSQL_PORT`,
> and leave `MSSQL_INSTANCE` blank. Use `MSSQL_INSTANCE` only for named-instance resolution through
> SQL Server Browser.

## 3. Configure environment

```bash
cp .env.example .env.local        # PowerShell: Copy-Item .env.example .env.local
```

Edit `.env.local`:

- **MSSQL**: `MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD`.
  For your hosted SQL Server use:
  ```dotenv
  MSSQL_AUTH=sql
  MSSQL_SERVER=176.74.16.213
  MSSQL_INSTANCE=
  MSSQL_PORT=1433
  MSSQL_DATABASE=IcePulse
  MSSQL_USER=IcePulse
  MSSQL_PASSWORD=your_real_password_here
  MSSQL_ENCRYPT=true
  MSSQL_TRUST_SERVER_CERTIFICATE=true
  MSSQL_REQUEST_TIMEOUT_MS=0
  ```
- **Google Ads**: developer token, OAuth `client_id`/`client_secret`, `refresh_token`, and
  `GOOGLE_ADS_CUSTOMER_ID` (digits only, no dashes). If the account is accessed through a manager
  (MCC) account, also set `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

`.env.local` is gitignored — never commit it.

### Getting Google Ads credentials (OAuth refresh-token flow)

1. A Google Ads **developer token** (Google Ads → Tools → API Center).
2. A **Desktop app OAuth client** (Google Cloud Console → APIs & Services → Credentials → Create
   credentials → OAuth client ID → **Desktop app**) → gives `client_id` (ends in
   `.apps.googleusercontent.com`) + `client_secret`.
3. The **customer id** of the account to pull (digits only, no dashes). If it sits under a manager
   (MCC) account, also set `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
4. Put `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
   `GOOGLE_ADS_CUSTOMER_ID` in `.env.local`, then generate a **refresh token**:

   ```bash
   npm run auth:google-ads
   ```

   This opens a Google consent screen, captures the result on `http://localhost:53777`, and prints a
   refresh token. Paste it into `.env.local` as `GOOGLE_ADS_REFRESH_TOKEN`.

### Alternative: service account (Workspace domain-wide delegation)

Set `GOOGLE_ADS_AUTH=service_account` to use a Google service account instead of OAuth. This only
works when your Google Ads account is under **Google Workspace** with **domain-wide delegation**:

1. **Service account + key:** in Google Cloud → IAM & Admin → Service Accounts, use (or create) a
   service account, download its **JSON key file**, and note its numeric **Client ID** (enable
   "domain-wide delegation" on the service account to get it).
2. **Authorize the scope (Workspace super-admin):** admin.google.com → Security → Access and data
   control → **API controls → Domain-wide delegation → Add new**. Client ID = the service account's
   numeric client id; OAuth scope = `https://www.googleapis.com/auth/adwords`.
3. **Set env** in `.env.local`:
   ```
   GOOGLE_ADS_AUTH=service_account
   GOOGLE_ADS_DEVELOPER_TOKEN=...
   GOOGLE_ADS_CUSTOMER_ID=...                 # digits only
   GOOGLE_ADS_LOGIN_CUSTOMER_ID=...           # only if under a manager (MCC)
   GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE=C:\path\to\service-account.json
   GOOGLE_ADS_IMPERSONATION_EMAIL=user@yourdomain.com   # a Workspace user WITH Ads access
   ```
4. Run `npm run sync:google-ads`. The connector mints an impersonated access token and calls the
   Google Ads API directly (no refresh token needed).

The impersonated user must have access to the Google Ads account, and the developer token must be
approved (or you must use a test account).

## 4. Install dependencies

```bash
npm install
```

## 5. Create schema + seed

```bash
npm run db:migrate    # creates tables (safe to re-run)
npm run db:seed       # default client + roadmap placeholders (no fake metrics)
```

## 6. First sync

```bash
npm run sync:google-ads                         # last 30 days
npm run sync:google-ads -- --from=2026-06-01 --to=2026-06-16
```

You should see a JSON log line ending in `Google Ads sync SUCCEEDED` with processed/inserted/updated
counts. The run is also recorded in the **Sync Centre**.

## 7. Run the dashboard

```bash
npm run dev
```

Open <http://localhost:3000>.

## Verify

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint
curl http://localhost:3000/api/health   # { status, database, config } — no secrets
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Could not connect to MSSQL ...` | Check SQL Server is reachable and `MSSQL_*` values are correct. For hosted fixed-port SQL Server, leave `MSSQL_INSTANCE` blank and set `MSSQL_PORT=1433`. For named instances use `MSSQL_INSTANCE` and start SQL Server Browser. For encryption errors set `MSSQL_TRUST_SERVER_CERTIFICATE=true`. |
| `Google Ads is not fully configured. Missing: ...` | Fill the listed variables in `.env.local`. |
| `invalid_grant` | The refresh token is expired/invalid — regenerate it. |
| `PERMISSION_DENIED` / no access | Verify the customer id and that the user/MCC has access; set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for manager accounts. |
| Dashboard shows empty states | No data yet — run a sync. |
| Migrations "already applied" | Expected; the runner tracks applied files in `schema_migrations`. |
