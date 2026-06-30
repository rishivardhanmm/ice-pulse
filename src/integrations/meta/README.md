# Meta integration (placeholder — Phase 2)

Not implemented yet. This folder reserves the extension point for Meta
(Facebook / Instagram) ad performance via the Meta Marketing API.

## How to implement later

1. Add a `connector.ts` that exports a class implementing `DataConnector`
   (`src/integrations/connector.ts`): `name`, `source: 'meta'`,
   `testConnection()`, and `sync(options)`.
2. Add Meta-specific tables (e.g. `meta_campaigns`,
   `meta_campaign_daily_metrics`) via a new migration in `database/migrations/`.
   Mirror the Google Ads shape so the dashboard aggregation stays uniform.
3. Add repositories under `src/server/db/repositories/` and surface the data
   through new API routes / dashboard widgets.
4. Register env vars in `src/server/config/env.ts` and `.env.example`.

No fake data or stubbed business logic should live here until it is built for real.
