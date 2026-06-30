# Canva integration — test plan

The project has no automated test runner, so this is a manual/verification plan. Each item lists what
to do and what to assert. (If a test runner is added later, these map 1:1 to unit/integration tests.)

## Prerequisites
- `.env.local` has `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, and ideally `CANVA_TOKEN_ENCRYPTION_KEY`.
- DB migrated: `npm run db:migrate` (creates the `canva_*` tables).
- Dev server: `npm run dev`, open `http://127.0.0.1:3000/canva`.

## 1. Missing config handling
- Temporarily blank `CANVA_CLIENT_ID` → `/canva` shows **Not configured** and the connect button is
  disabled; `GET /api/canva/status` returns `configured: false`. `getCanvaConfig()` throws a clear,
  value-free error.

## 2. OAuth URL creation (PKCE)
- Hit `GET /api/canva/connect`. Assert it 302-redirects to `CANVA_OAUTH_AUTHORIZE_URL` with
  `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, and
  `code_challenge_method=S256`. Assert `Set-Cookie` for `canva_oauth_state` + `canva_oauth_verifier`
  (httpOnly).

## 3. State validation (anti-CSRF)
- Call `/api/canva/callback?code=x&state=wrong` (cookie state differs) → redirects to
  `/canva?error=invalid_state`; no token exchange occurs.
- Callback with no `code` → `?error=invalid_state`. Callback with `?error=access_denied` → that error
  is surfaced.

## 4. Token exchange + secure storage
- Complete a real connect. Assert: a `canva_connections` row (`connection_status='connected'`), a
  `canva_oauth_tokens` row whose `access_token_encrypted`/`refresh_token_encrypted` are **not**
  readable plaintext (and `token_enc_version='v1'` when a key is set). Assert no token value appears in
  server logs.

## 5. Token refresh logic
- With a connection present, set `canva_oauth_tokens.expires_at` to the past → trigger any authed call
  (e.g. **Refresh capabilities**). Assert the token is refreshed (new `expires_at`, connection
  `last_refreshed_at` updated). Simulate a failed refresh (e.g. bad refresh token) → connection becomes
  `expired` and the caller gets a clear "reconnect" error.

## 6. Capability parsing
- After connect, `canva_capabilities` has rows for `brand_template`, `autofill`, `asset_upload`,
  `export`. For a non-Enterprise account assert `brand_template` and `autofill` are `is_available=0`,
  while `export` (with `design:content:read`) and `asset_upload` (with `asset:write`) reflect the
  granted scopes. The `/canva` page shows each as Available/Unavailable.

## 7. Template sync response handling
- Click **Sync templates**. If `brand_template` available → templates are upserted into
  `canva_templates` and listed (idempotent on re-sync). If unavailable (401/403/404) → response is
  `{ available: false, synced: 0, reason: ... }` and the UI shows the friendly unavailable note (no
  crash).

## 8. Unauthorised / not-connected access protection
- With no active connection: `POST /api/canva/sync-templates`, `/refresh-capabilities`, `/export-design`
  return **409 "Canva is not connected."**; `GET /api/canva/templates` returns `{ templates: [] }`.
- Assert `/api/canva/status` never includes any token field.

## 9. Unavailable Autofill behaviour
- `POST /api/canva/generate-report-placeholder` returns the data `payload` plus
  `generation.autofillAvailable=false` and the friendly Autofill-unavailable message; it does **not**
  attempt to create a Canva design. The `/canva` page renders the message.

## 10. Export (when a design id is available)
- `POST /api/canva/export-design` with `{ canvaDesignId, format: "pdf" }` → creates a
  `canva_export_jobs` row, polls, and returns `status` (`in_progress|success|failed`). On success the
  short-lived `download_url` is stored and returned to the internal UI only.

## 11. Report payload from real data
- `POST /api/canva/report-preview-payload` with `{ from, to }` → returns `CanvaReportPayload` populated
  from live Google Ads data (spend/clicks/CTR/conversions, top & worst campaign, a recommendation from
  signals). No mock data.
