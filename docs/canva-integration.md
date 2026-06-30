# Canva integration (internal)

Pulse integrates with Canva via the **Canva Connect APIs** using a **Public integration in
draft/testing mode**. This is an **internal** integration for ICE Creates — it is **not** a public
marketplace app and is **not** submitted for Canva review.

> ICE cannot use Canva Enterprise, and Private integrations require Enterprise. A Public integration
> in draft/testing mode lets a small set of authorised Canva users connect their own account without
> publishing anything. ICE's templates/designs stay private to the connected Canva account.

## How to create a Canva Public draft integration

1. Go to the [Canva Developer portal](https://www.canva.com/developers/) → **Your integrations** →
   **Create an integration** → **Public** (keep it in **Draft / testing**; do **not** submit for review).
2. Under **Configuration**, note the **Client ID** and generate a **Client secret**.
3. Under **Scopes**, enable the scopes Pulse requests (see below). Request the minimum you need.
4. Under **Authentication / Redirect URLs**, add the redirect URL (see below). It must match
   `CANVA_REDIRECT_URI` **exactly**.
5. Add the Canva account(s) allowed to connect while in draft (testing users).

## Required environment variables

Set these in `.env.local` (never commit real secrets). See `.env.example` for the template.

| Variable | Purpose | Default |
| --- | --- | --- |
| `CANVA_CLIENT_ID` | Integration client id | — (required) |
| `CANVA_CLIENT_SECRET` | Integration client secret | — (required) |
| `CANVA_REDIRECT_URI` | OAuth redirect (must match the portal exactly) | `http://127.0.0.1:3000/api/canva/callback` |
| `CANVA_SCOPES` | Space-separated scopes (only ones ENABLED in the portal) | `profile:read design:meta:read design:content:read brandtemplate:meta:read asset:read` |
| `CANVA_API_BASE_URL` | REST base | `https://api.canva.com/rest/v1` |
| `CANVA_OAUTH_AUTHORIZE_URL` | Authorize endpoint | `https://www.canva.com/api/oauth/authorize` |
| `CANVA_OAUTH_TOKEN_URL` | Token endpoint | `https://api.canva.com/rest/v1/oauth/token` |
| `CANVA_TOKEN_ENCRYPTION_KEY` | 32+ char key to encrypt tokens at rest (AES-256-GCM) | — (strongly recommended) |

## Redirect URL setup

Canva only allows `http` for `127.0.0.1` in local development (not `localhost`). For local testing use
`http://127.0.0.1:3000/api/canva/callback`, register that exact URL in the portal, run `npm run dev`,
and open Pulse at `http://127.0.0.1:3000`. For deployed environments use the HTTPS public URL.

## Required scopes

- `profile:read` — identity + capabilities (`/users/me`, `/users/me/capabilities`).
- `design:meta:read`, `design:content:read` — design metadata and **export**.
- `brandtemplate:meta:read` — list brand templates (Enterprise-gated, see below).
- `asset:read` — reading assets (optional now; needed for future asset features).
- `asset:write` — **not requested yet** (asset upload is future). To enable it later, tick the `asset`
  **Write** box in the portal AND add `asset:write` to `CANVA_SCOPES` — both must agree.

**"invalid scope" means you requested a scope that isn't ENABLED in the portal.** Every scope in
`CANVA_SCOPES` must have its box ticked in the portal's Reading/writing table. Specifying a `:write`
scope does not grant the matching `:read` — list each one you need.

## How to connect Canva from Pulse

1. Go to **Platform → Canva** (`/canva`).
2. Click **Connect Canva** → authorise on Canva → you're redirected back with the connection saved.
3. Pulse stores the connection, encrypted tokens, and the account's capabilities.
4. Use **Refresh capabilities**, **Sync templates**, and the **report payload preview** from that page.

## What works with Canva Business/Teams vs Enterprise

| Feature | Requirement | Notes |
| --- | --- | --- |
| OAuth connect, profile, capabilities | Any account | Works in draft/testing |
| **Design export** (pdf/png/jpg) | `design:content:read` | Generally available |
| Asset upload | `asset:write` | Modular; future |
| **Brand templates** (list/sync) | `brand_template` capability — **Canva Enterprise** | Reported unavailable otherwise |
| **Autofill** (auto-generate reports) | `autofill` capability — **Canva Enterprise** | Reported unavailable otherwise |

Because ICE is not Enterprise, brand-template and Autofill capabilities will usually be **unavailable**.
The UI marks them clearly and the rest of the integration keeps working. Autofill report generation is
**not** implemented until the connected account actually reports the capability and the official flow
is confirmed.

## Why we are not submitting for Canva public review yet

This is an internal tool. We only need a small set of authorised ICE users to connect their Canva
accounts (draft/testing mode), so there is no need (or intent) to publish a public marketplace app or
go through Canva's public review.

## Security notes

- OAuth tokens are **never** exposed to the frontend (only a value-free status DTO is returned).
- Tokens are **never** logged (the logger also redacts token-like keys) and are **encrypted at rest**
  (AES-256-GCM) when `CANVA_TOKEN_ENCRYPTION_KEY` is set — set it before any real use.
- OAuth uses Authorization Code + **PKCE (S256)** and validates `state` (anti-CSRF) via an httpOnly cookie.
- Minimum scopes; capability/connection checks before listing templates, exporting, or generating.
- Token expiry/refresh is handled; revoked/expired consent marks the connection `expired`.
- Canva export download links are short-lived and kept internal (behind Pulse).

## Future roadmap

1. OAuth connect + capability check + settings UI ✅ (this foundation)
2. Brand template sync ✅ (capability-gated)
3. Report payload preparation ✅ (from live Pulse data)
4. Asset upload (push Pulse charts/logos to Canva) — when needed
5. Autofill report generation — **only** if the connected account reports the `autofill` capability
6. Client/campaign → template mapping and one-click branded client reports

See also `docs/canva-integration-test-plan.md`.
