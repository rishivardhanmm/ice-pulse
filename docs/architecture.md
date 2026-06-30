# ICE Pulse — Architecture

## Overview

ICE Pulse is a single **Next.js (App Router)** application that serves both the dashboard UI and the
JSON API. A separate **sync layer** pulls data from external sources into **MSSQL**; the dashboard
only ever reads from MSSQL. This separation is the core design principle and keeps the UI fast and
resilient (no live third-party calls on page load).

```
                       ┌────────────────────────────┐
   Google Ads API ────▶│  GoogleAdsConnector.sync()  │
                       │  (src/integrations/...)     │
                       └──────────────┬──────────────┘
                                      │ upsert (MERGE)
                                      ▼
                              ┌───────────────┐
                              │     MSSQL     │
                              └───────┬───────┘
                                      │ read
            ┌─────────────────────────┴───────────────────────────┐
            ▼                                                       ▼
   repositories (src/server/db)                          services (aggregation,
            │                                              deterministic insights)
            └──────────────────────┬───────────────────────────────┘
                                   ▼
                      /api/* route handlers (Node runtime)
                                   ▼
                  Dashboard pages & components (React)
```

Triggers for a sync:
- CLI: `npm run sync:google-ads [-- --from= --to=]`
- API/UI: `POST /api/sync/google-ads` (Sync Centre button)

Both paths call the **same** `GoogleAdsConnector`, so behaviour is identical.

## Layers

- **`src/integrations`** — the `DataConnector` contract (`testConnection`, `sync`) and the real
  Google Ads implementation (`client`, `query`, `mapper`, `errors`, `connector`). Other sources are
  placeholders (READMEs only).
- **`src/server/db`** — a pooled MSSQL connection (`pool.ts`) and **repositories** (one module per
  table area). All SQL is parameterised; upserts use `MERGE`.
- **`src/server/services`** — `dashboard.service.ts` composes repository calls into UI-ready DTOs;
  `insights.ts` builds deterministic (non-AI) insight cards.
- **`src/server/config/env.ts`** — `zod`-validated environment, accessed lazily and never logged.
- **`src/app/api/*`** — thin route handlers (Node runtime, `force-dynamic`) that validate input and
  delegate to services/repositories.
- **`src/components` + `src/app`** — the dashboard UI; client components fetch `/api` via a small
  `useFetch` hook, with loading / empty / error states throughout.

## Data flow (read path)

1. A page (e.g. Dashboard) reads the `?from`/`?to` range from the URL.
2. A client component calls the matching `/api` endpoint.
3. The route handler validates params and calls a service.
4. The service calls repositories which run aggregation SQL against MSSQL.
5. Clean DTOs (`src/lib/types.ts`) are returned and rendered.

Derived metrics (CTR, average CPC, cost/conversion, conversion rate) are **computed from summed
spend/clicks/impressions/conversions**, so aggregates are always internally consistent rather than
averaging pre-computed daily rates.

## Database design

Microsoft SQL Server. Full DDL in [`database/schema.sql`](../database/schema.sql); applied via
versioned files in `database/migrations/` (tracked in `schema_migrations`).

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `clients` | ICE clients/services (multi-client ready; v1 uses one default) | unique `slug` |
| `platform_accounts` | Connected accounts (Google Ads now; Meta/Zoho later) | unique `(platform, external_account_id)` |
| `google_ads_campaigns` | Campaign identity/details | unique `(google_customer_id, google_campaign_id)` |
| `google_ads_campaign_daily_metrics` | Daily performance + `raw_payload_json` | unique `(campaign_id, metric_date)` |
| `sync_runs` | One row per sync execution (audit) | indexed by `(source, started_at)` |
| `future_data_sources` | Documented extension points (incl. external results DB) | unique `name` |

`cost_micros` is stored raw **and** converted to `cost` (÷ 1,000,000). The raw API row is kept in
`raw_payload_json` for debugging. Uniqueness + `MERGE` make syncs idempotent.

## Google Ads sync flow

1. `getGoogleAdsConfig()` validates credentials (clear error listing any missing vars).
2. A `sync_runs` row is opened (`running`).
3. A GAQL query (campaign metrics segmented by day) runs for the date range.
4. For each row: ensure the `platform_account` exists (auto-created under the default client) →
   `MERGE` campaign → `MERGE` daily metric. Enum values and null metrics are handled defensively.
5. The run is closed (`success`/`failed`) with processed/inserted/updated counts (and error text).

## Future integrations

Each future source becomes a folder under `src/integrations/` exporting a `DataConnector`, plus its
own migration(s), repositories and API routes. The dashboard composes additional sources the same
way it composes Google Ads today.

The **company results database** is deliberately not modelled — its schema is unknown. When details
arrive it will likely link results back to campaigns via a shared key (e.g. `google_campaign_id`).

## AI layer (future)

`src/ai/` is reserved for the future AI insights/reporting assistant. It will consume
already-aggregated metrics (never secrets) and default to the latest Claude models. The current
"Pulse Assistant" and insight cards are **rule-based, not AI**, and are clearly labelled as such.
