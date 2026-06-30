# Power BI integration (placeholder — Phase 3)

Not implemented yet. Reserves the extension point for embedded Power BI reports
and datasets.

Power BI is primarily an **embedding / reporting** surface rather than a sync
source, so this may not implement `DataConnector` directly. Likely approach:
store workspace/report ids + an embed-token service, and render via the Power BI
JavaScript/React embedding SDK in a dashboard page. Add config to
`src/server/config/env.ts` and `.env.example` when built. No stubbed logic yet.
