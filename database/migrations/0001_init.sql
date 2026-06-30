-- =====================================================================
-- ICE Pulse — Migration 0001: initial schema
-- ---------------------------------------------------------------------
-- Target: Microsoft SQL Server (local).
-- Idempotent: every object is guarded so the file is safe to re-run.
-- Batches are separated by `GO`; the migration runner splits on it.
-- =====================================================================

-- ── clients ──────────────────────────────────────────────────────────
-- ICE clients / services. A single default "internal" client is enough
-- for v1, but the schema supports many clients from day one.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'clients')
BEGIN
  CREATE TABLE dbo.clients (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_clients PRIMARY KEY,
    name         NVARCHAR(200)     NOT NULL,
    slug         NVARCHAR(120)     NOT NULL,
    description  NVARCHAR(1000)    NULL,
    status       NVARCHAR(40)      NOT NULL CONSTRAINT DF_clients_status DEFAULT ('active'),
    created_at   DATETIME2(3)      NOT NULL CONSTRAINT DF_clients_created DEFAULT (SYSUTCDATETIME()),
    updated_at   DATETIME2(3)      NOT NULL CONSTRAINT DF_clients_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_clients_slug UNIQUE (slug)
  );
END
GO

-- ── platform_accounts ────────────────────────────────────────────────
-- Connected external accounts (Google Ads now; Meta / Zoho / etc later).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'platform_accounts')
BEGIN
  CREATE TABLE dbo.platform_accounts (
    id                   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_platform_accounts PRIMARY KEY,
    client_id            INT           NOT NULL,
    platform             NVARCHAR(40)  NOT NULL,   -- 'google_ads', 'meta', 'zoho', ...
    account_name         NVARCHAR(200) NULL,
    external_account_id  NVARCHAR(64)  NOT NULL,   -- e.g. Google Ads customer id (digits only)
    currency_code        NVARCHAR(8)   NULL,
    timezone             NVARCHAR(64)  NULL,
    status               NVARCHAR(40)  NOT NULL CONSTRAINT DF_platform_accounts_status DEFAULT ('active'),
    created_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_platform_accounts_created DEFAULT (SYSUTCDATETIME()),
    updated_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_platform_accounts_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_platform_accounts_client FOREIGN KEY (client_id) REFERENCES dbo.clients (id),
    CONSTRAINT UQ_platform_accounts_platform_external UNIQUE (platform, external_account_id)
  );
  CREATE INDEX IX_platform_accounts_client ON dbo.platform_accounts (client_id);
END
GO

-- ── google_ads_campaigns ─────────────────────────────────────────────
-- Campaign identity / details (one row per campaign).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'google_ads_campaigns')
BEGIN
  CREATE TABLE dbo.google_ads_campaigns (
    id                         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_google_ads_campaigns PRIMARY KEY,
    platform_account_id        INT           NOT NULL,
    google_customer_id         NVARCHAR(32)  NOT NULL,
    google_campaign_id         NVARCHAR(32)  NOT NULL,
    campaign_name              NVARCHAR(512) NULL,
    campaign_status            NVARCHAR(40)  NULL,
    advertising_channel_type   NVARCHAR(64)  NULL,
    start_date                 DATE          NULL,
    end_date                   DATE          NULL,
    created_at                 DATETIME2(3)  NOT NULL CONSTRAINT DF_gac_created DEFAULT (SYSUTCDATETIME()),
    updated_at                 DATETIME2(3)  NOT NULL CONSTRAINT DF_gac_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_gac_platform_account FOREIGN KEY (platform_account_id) REFERENCES dbo.platform_accounts (id),
    CONSTRAINT UQ_gac_customer_campaign UNIQUE (google_customer_id, google_campaign_id)
  );
  CREATE INDEX IX_gac_platform_account ON dbo.google_ads_campaigns (platform_account_id);
END
GO

-- ── google_ads_campaign_daily_metrics ────────────────────────────────
-- One row per campaign per day. Unique on (campaign_id, metric_date) so
-- syncs upsert (MERGE) rather than duplicate.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'google_ads_campaign_daily_metrics')
BEGIN
  CREATE TABLE dbo.google_ads_campaign_daily_metrics (
    id                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_gacdm PRIMARY KEY,
    campaign_id          INT            NOT NULL,
    metric_date          DATE           NOT NULL,
    impressions          BIGINT         NOT NULL CONSTRAINT DF_gacdm_impr DEFAULT (0),
    clicks               BIGINT         NOT NULL CONSTRAINT DF_gacdm_clicks DEFAULT (0),
    cost_micros          BIGINT         NOT NULL CONSTRAINT DF_gacdm_costmicros DEFAULT (0),
    cost                 DECIMAL(18,2)  NOT NULL CONSTRAINT DF_gacdm_cost DEFAULT (0),
    conversions          DECIMAL(18,4)  NOT NULL CONSTRAINT DF_gacdm_conv DEFAULT (0),
    conversions_value    DECIMAL(18,4)  NOT NULL CONSTRAINT DF_gacdm_convval DEFAULT (0),
    ctr                  DECIMAL(9,6)   NULL,
    average_cpc          DECIMAL(18,4)  NULL,
    cost_per_conversion  DECIMAL(18,4)  NULL,
    conversion_rate      DECIMAL(12,6)  NULL,  -- can exceed 100% (conversions may outnumber clicks)
    raw_payload_json     NVARCHAR(MAX)  NULL,
    created_at           DATETIME2(3)   NOT NULL CONSTRAINT DF_gacdm_created DEFAULT (SYSUTCDATETIME()),
    updated_at           DATETIME2(3)   NOT NULL CONSTRAINT DF_gacdm_updated DEFAULT (SYSUTCDATETIME()),
    last_synced_at       DATETIME2(3)   NOT NULL CONSTRAINT DF_gacdm_synced DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_gacdm_campaign FOREIGN KEY (campaign_id) REFERENCES dbo.google_ads_campaigns (id),
    CONSTRAINT UQ_gacdm_campaign_date UNIQUE (campaign_id, metric_date)
  );
  CREATE INDEX IX_gacdm_date ON dbo.google_ads_campaign_daily_metrics (metric_date);
  CREATE INDEX IX_gacdm_campaign_date ON dbo.google_ads_campaign_daily_metrics (campaign_id, metric_date);
END
GO

-- ── sync_runs ────────────────────────────────────────────────────────
-- One row per sync job execution (any source).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'sync_runs')
BEGIN
  CREATE TABLE dbo.sync_runs (
    id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sync_runs PRIMARY KEY,
    source              NVARCHAR(40)  NOT NULL,   -- 'google_ads', ...
    status              NVARCHAR(20)  NOT NULL,   -- 'running' | 'success' | 'failed'
    started_at          DATETIME2(3)  NOT NULL CONSTRAINT DF_sync_runs_started DEFAULT (SYSUTCDATETIME()),
    finished_at         DATETIME2(3)  NULL,
    records_processed   INT           NOT NULL CONSTRAINT DF_sync_runs_proc DEFAULT (0),
    records_inserted    INT           NOT NULL CONSTRAINT DF_sync_runs_ins DEFAULT (0),
    records_updated     INT           NOT NULL CONSTRAINT DF_sync_runs_upd DEFAULT (0),
    error_message       NVARCHAR(MAX) NULL,
    metadata_json       NVARCHAR(MAX) NULL
  );
  CREATE INDEX IX_sync_runs_source_started ON dbo.sync_runs (source, started_at DESC);
END
GO

-- ── future_data_sources ──────────────────────────────────────────────
-- Documented extension point for upcoming integrations and the external
-- company "campaign results" database. No business logic — placeholder only.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'future_data_sources')
BEGIN
  CREATE TABLE dbo.future_data_sources (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_future_data_sources PRIMARY KEY,
    name         NVARCHAR(200)  NOT NULL,
    source_type  NVARCHAR(80)   NULL,
    description  NVARCHAR(1000) NULL,
    status       NVARCHAR(40)   NOT NULL CONSTRAINT DF_fds_status DEFAULT ('planned'),
    created_at   DATETIME2(3)   NOT NULL CONSTRAINT DF_fds_created DEFAULT (SYSUTCDATETIME()),
    updated_at   DATETIME2(3)   NOT NULL CONSTRAINT DF_fds_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_future_data_sources_name UNIQUE (name)
  );
END
GO
