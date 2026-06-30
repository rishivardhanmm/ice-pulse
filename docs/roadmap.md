# ICE Pulse — Roadmap

ICE Pulse is being built in phases. Only **Phase 1** is implemented today; later phases are
represented in the app as clearly-marked placeholders (see the **Roadmap** page), with extension
points already in the codebase (`src/integrations/`, `future_data_sources`).

## Phase 1 — Foundation ✅ (current)

- Internal marketing intelligence dashboard (ICE-branded UI)
- Google Ads data sync via the API
- Local MSSQL data store (schema, migrations, seeds)
- Campaign performance UI: KPI cards, trend chart, campaign table + detail drawer
- Sync Centre (connection status, manual sync, history)
- Deterministic insight cards + rule-based "Pulse Assistant"

## Phase 2 — More channels

- Meta integration (Facebook / Instagram ad performance)
- Zoho scheduling (scheduled posts)
- Social post performance tracking
- Campaign calendar

## Phase 3 — Workflow & reporting

- Canva design/assets workflow
- Internal approvals
- Client share zone (read-only client reporting)
- Power BI embedded reporting
- Budget tracking (spend vs budget)

## Phase 4 — Intelligence

- AI insights (powered by the latest Claude models)
- AI reporting assistant
- Newsjacking centre
- Campaign recommendations

## Cross-cutting / external

- **Company results database**: a separate company database holding campaign outcomes/results.
  Schema is not yet known and is intentionally not implemented — only a documented placeholder
  exists (`future_data_sources`, `src/integrations/company-results/`). When details are provided it
  will be linked back to campaigns via a shared key.

## How new modules slot in

1. Add `src/integrations/<source>/connector.ts` implementing `DataConnector`.
2. Add tables via a new `database/migrations/NNNN_*.sql` (mirror the Google Ads shape).
3. Add repositories, services and `/api` routes.
4. Surface the data in the dashboard and flip the relevant Roadmap card to "live".
