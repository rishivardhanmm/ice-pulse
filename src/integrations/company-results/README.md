# Company Results Database (placeholder — future phase)

Not implemented yet, and intentionally **not guessed**. This reserves the
extension point for the separate company database that holds campaign
**results / outcomes** (e.g. leads, sales, attributed revenue).

## Status

- The external schema is **unknown** at this stage — do not invent it.
- `future_data_sources` (seeded row "Company Results Database") documents that
  this connection is planned.

## When details arrive

1. Decide integration style: read-only SQL connection, API, or scheduled export.
2. If it is a sync source, implement `DataConnector`
   (`src/integrations/connector.ts`) with `source: 'company_results'` and add
   result tables via a migration — ideally linking results back to campaigns
   (e.g. by `google_campaign_id` or a shared campaign key).
3. Surface "results vs spend" views in the dashboard.

Until the real schema is provided, this folder must contain **no business logic**.
