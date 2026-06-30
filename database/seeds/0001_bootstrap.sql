-- =====================================================================
-- ICE Pulse — Seed 0001: bootstrap reference data
-- ---------------------------------------------------------------------
-- Idempotent (MERGE on natural keys). Seeds ONLY structural/reference
-- rows — a default internal client and the "future data sources" roadmap
-- placeholders. NO fabricated campaign metrics: real performance data is
-- populated exclusively by the Google Ads sync.
-- =====================================================================

-- Default internal client. Google Ads accounts attach here until you add
-- per-client accounts later.
MERGE dbo.clients AS t
USING (SELECT
        N'ICE Creates (Internal)' AS name,
        N'ice-internal'           AS slug,
        N'Default internal workspace for ICE Pulse. Connected platform accounts attach here until per-client workspaces are added.' AS description,
        N'active'                 AS status
) AS s
ON (t.slug = s.slug)
WHEN MATCHED THEN
  UPDATE SET name = s.name, description = s.description, status = s.status, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (name, slug, description, status) VALUES (s.name, s.slug, s.description, s.status);
GO

-- Roadmap placeholders. These describe where future integrations and the
-- external company "campaign results" database will connect. Documentation
-- only — the app does not run any logic against these rows yet.
MERGE dbo.future_data_sources AS t
USING (VALUES
  (N'Meta Ads',                 N'ads',        N'Facebook / Instagram ad performance via the Meta Marketing API.'),
  (N'Zoho Social',              N'social',     N'Scheduled posts and social engagement from Zoho Social.'),
  (N'Social Post Performance',  N'social',     N'Organic social post metrics across connected channels.'),
  (N'Canva',                    N'design',     N'Design and creative asset workflow from Canva.'),
  (N'Power BI',                 N'reporting',  N'Embedded Power BI reports and datasets.'),
  (N'Company Results Database', N'results',    N'External company database holding campaign outcomes/results. Schema TBD — connects in a later phase.'),
  (N'Client Share Zone',        N'portal',     N'Read-only client-facing share area for approved reports.'),
  (N'Approvals',                N'workflow',   N'Internal approval flows for campaigns and creative.'),
  (N'AI Insights',              N'ai',         N'AI-generated insights and campaign recommendations layer.')
) AS s (name, source_type, description)
ON (t.name = s.name)
WHEN MATCHED THEN
  UPDATE SET source_type = s.source_type, description = s.description, updated_at = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
  INSERT (name, source_type, description, status) VALUES (s.name, s.source_type, s.description, N'planned');
GO
