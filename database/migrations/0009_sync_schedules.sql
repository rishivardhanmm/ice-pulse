-- 0009_sync_schedules.sql
-- Admin-configurable auto-sync schedule per data source.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'sync_schedules')
BEGIN
  CREATE TABLE dbo.sync_schedules (
    id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sync_schedules PRIMARY KEY,
    source            NVARCHAR(40)  NOT NULL,
    enabled           BIT           NOT NULL CONSTRAINT DF_ss_enabled DEFAULT (1),
    interval_minutes  INT           NOT NULL CONSTRAINT DF_ss_interval DEFAULT (60),
    lookback_days     INT           NOT NULL CONSTRAINT DF_ss_lookback DEFAULT (3),
    last_run_at       DATETIME2(3)  NULL,
    last_status       NVARCHAR(20)  NULL,
    updated_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_ss_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_sync_schedules_source UNIQUE (source)
  );

  INSERT INTO dbo.sync_schedules (source) VALUES ('google_ads'), ('meta_ads');
END
GO
