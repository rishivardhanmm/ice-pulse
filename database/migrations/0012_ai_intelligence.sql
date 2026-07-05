-- 0012_ai_intelligence.sql
-- AI Anomaly Watch + weekly digest scheduling.
--
-- ai_anomalies: one row per detected metric anomaly (campaign/day/metric),
-- found deterministically (z-score vs a trailing baseline — no AI tokens) and
-- then narrated by ONE batched AI call. The unique key makes detection
-- idempotent: re-running a day never duplicates rows.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_anomalies')
BEGIN
  CREATE TABLE dbo.ai_anomalies (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ai_anomalies PRIMARY KEY,
    source         NVARCHAR(20)   NOT NULL,  -- 'google_ads' | 'meta_ads'
    campaign_id    INT            NOT NULL,  -- id in the source's campaigns table
    campaign_name  NVARCHAR(512)  NOT NULL,
    metric         NVARCHAR(40)   NOT NULL,  -- 'spend' | 'clicks' | 'conversions' | 'ctr'
    metric_date    DATE           NOT NULL,
    actual_value   DECIMAL(18,4)  NOT NULL,
    expected_value DECIMAL(18,4)  NOT NULL,  -- trailing-window mean
    z_score        DECIMAL(9,3)   NOT NULL,
    direction      NVARCHAR(10)   NOT NULL,  -- 'spike' | 'drop'
    severity       NVARCHAR(10)   NOT NULL,  -- 'high' | 'medium'
    narrative      NVARCHAR(1000) NULL,      -- AI-written explanation (filled after detection)
    created_at     DATETIME2(3)   NOT NULL CONSTRAINT DF_ai_anomalies_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_ai_anomalies UNIQUE (source, campaign_id, metric, metric_date)
  );
  CREATE INDEX IX_ai_anomalies_date ON dbo.ai_anomalies (metric_date DESC);
END
GO

-- Scheduler rows for the AI jobs (the scheduler skips sources it has no
-- runner for, and the admin sync-schedules UI lets these be toggled/tuned).
IF NOT EXISTS (SELECT 1 FROM dbo.sync_schedules WHERE source = 'ai_anomaly_watch')
  INSERT INTO dbo.sync_schedules (source, enabled, interval_minutes, lookback_days)
  VALUES ('ai_anomaly_watch', 1, 1440, 3);      -- daily; scans the last 3 days

IF NOT EXISTS (SELECT 1 FROM dbo.sync_schedules WHERE source = 'weekly_digest')
  INSERT INTO dbo.sync_schedules (source, enabled, interval_minutes, lookback_days)
  VALUES ('weekly_digest', 1, 10080, 7);        -- weekly; reports on the last 7 days
GO
