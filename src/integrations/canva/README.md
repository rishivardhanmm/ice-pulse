# Canva integration (placeholder — Phase 3)

Not implemented yet. Reserves the extension point for the Canva design / asset
workflow (e.g. linking creative assets to campaigns).

Implement by adding a `connector.ts` implementing `DataConnector`
(`src/integrations/connector.ts`) with `source: 'canva'`, plus migrations,
repositories, API routes, and env vars. No stubbed logic until built for real.
