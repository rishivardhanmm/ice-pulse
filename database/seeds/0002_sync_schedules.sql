-- =====================================================================
-- ICE Pulse — Seed 0002: sync schedule baseline rows
-- ---------------------------------------------------------------------
-- Idempotent (MERGE on natural key). Ensures one row per syncable source
-- exists so the in-process scheduler (src/server/services/scheduler.service.ts)
-- has something to check. Only INSERTs missing sources — never overwrites an
-- admin's saved interval/enabled choice on a source that already exists.
-- =====================================================================

MERGE dbo.sync_schedules AS t
USING (VALUES (N'google_ads'), (N'meta_ads')) AS s (source)
ON (t.source = s.source)
WHEN NOT MATCHED THEN
  INSERT (source) VALUES (s.source);
GO
