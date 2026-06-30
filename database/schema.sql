-- =====================================================================
-- ICE Pulse — consolidated schema reference (Microsoft SQL Server)
-- ---------------------------------------------------------------------
-- This is a human-readable snapshot of the current schema. It is NOT the
-- source of truth — apply changes through versioned files in
-- database/migrations/ (run via `npm run db:migrate`). Keep this file in
-- sync when you add a migration.
-- =====================================================================

-- clients ─ ICE clients / services (multi-client ready; v1 uses one default).
CREATE TABLE dbo.clients (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(200)  NOT NULL,
  slug        NVARCHAR(120)  NOT NULL UNIQUE,
  description NVARCHAR(1000) NULL,
  status      NVARCHAR(40)   NOT NULL DEFAULT ('active'),
  created_at  DATETIME2(3)   NOT NULL DEFAULT (SYSUTCDATETIME()),
  updated_at  DATETIME2(3)   NOT NULL DEFAULT (SYSUTCDATETIME())
);

-- platform_accounts ─ connected external accounts (Google Ads, Meta, ...).
CREATE TABLE dbo.platform_accounts (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  client_id           INT NOT NULL REFERENCES dbo.clients (id),
  platform            NVARCHAR(40)  NOT NULL,
  account_name        NVARCHAR(200) NULL,
  external_account_id NVARCHAR(64)  NOT NULL,
  currency_code       NVARCHAR(8)   NULL,
  timezone            NVARCHAR(64)  NULL,
  status              NVARCHAR(40)  NOT NULL DEFAULT ('active'),
  created_at          DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  updated_at          DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT UQ_platform_accounts_platform_external UNIQUE (platform, external_account_id)
);

-- google_ads_campaigns ─ campaign identity (unique per customer+campaign).
CREATE TABLE dbo.google_ads_campaigns (
  id                       INT IDENTITY(1,1) PRIMARY KEY,
  platform_account_id      INT NOT NULL REFERENCES dbo.platform_accounts (id),
  google_customer_id       NVARCHAR(32)  NOT NULL,
  google_campaign_id       NVARCHAR(32)  NOT NULL,
  campaign_name            NVARCHAR(512) NULL,
  campaign_status          NVARCHAR(40)  NULL,
  advertising_channel_type NVARCHAR(64)  NULL,
  start_date               DATE          NULL,
  end_date                 DATE          NULL,
  created_at               DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  updated_at               DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT UQ_gac_customer_campaign UNIQUE (google_customer_id, google_campaign_id)
);

-- google_ads_campaign_daily_metrics ─ daily performance (unique per day).
CREATE TABLE dbo.google_ads_campaign_daily_metrics (
  id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
  campaign_id         INT NOT NULL REFERENCES dbo.google_ads_campaigns (id),
  metric_date         DATE NOT NULL,
  impressions         BIGINT        NOT NULL DEFAULT (0),
  clicks              BIGINT        NOT NULL DEFAULT (0),
  cost_micros         BIGINT        NOT NULL DEFAULT (0),
  cost                DECIMAL(18,2) NOT NULL DEFAULT (0),
  conversions         DECIMAL(18,4) NOT NULL DEFAULT (0),
  conversions_value   DECIMAL(18,4) NOT NULL DEFAULT (0),
  ctr                 DECIMAL(9,6)  NULL,
  average_cpc         DECIMAL(18,4) NULL,
  cost_per_conversion DECIMAL(18,4) NULL,
  conversion_rate     DECIMAL(12,6) NULL,
  raw_payload_json    NVARCHAR(MAX) NULL,
  created_at          DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  updated_at          DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  last_synced_at      DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT UQ_gacdm_campaign_date UNIQUE (campaign_id, metric_date)
);

-- sync_runs ─ audit row per sync execution.
CREATE TABLE dbo.sync_runs (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  source            NVARCHAR(40)  NOT NULL,
  status            NVARCHAR(20)  NOT NULL,
  started_at        DATETIME2(3)  NOT NULL DEFAULT (SYSUTCDATETIME()),
  finished_at       DATETIME2(3)  NULL,
  records_processed INT           NOT NULL DEFAULT (0),
  records_inserted  INT           NOT NULL DEFAULT (0),
  records_updated   INT           NOT NULL DEFAULT (0),
  error_message     NVARCHAR(MAX) NULL,
  metadata_json     NVARCHAR(MAX) NULL
);

-- future_data_sources ─ roadmap placeholders / extension points only.
CREATE TABLE dbo.future_data_sources (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  name        NVARCHAR(200)  NOT NULL UNIQUE,
  source_type NVARCHAR(80)   NULL,
  description NVARCHAR(1000) NULL,
  status      NVARCHAR(40)   NOT NULL DEFAULT ('planned'),
  created_at  DATETIME2(3)   NOT NULL DEFAULT (SYSUTCDATETIME()),
  updated_at  DATETIME2(3)   NOT NULL DEFAULT (SYSUTCDATETIME())
);
