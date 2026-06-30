-- 0007_meta_ads.sql
-- Meta Ads (Facebook / Instagram) campaign data.
-- Mirrors the Google Ads schema: one row per campaign, one row per campaign/day.
-- client_id is nullable (assigned by ICE staff in admin UI, same as Google Ads).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'meta_ads_campaigns')
BEGIN
  CREATE TABLE dbo.meta_ads_campaigns (
    id                   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_meta_ads_campaigns PRIMARY KEY,
    platform_account_id  INT           NOT NULL
                           CONSTRAINT FK_mac_platform_account REFERENCES dbo.platform_accounts(id),
    client_id            INT           NULL
                           CONSTRAINT FK_mac_client REFERENCES dbo.clients(id) ON DELETE SET NULL,
    meta_account_id      NVARCHAR(64)  NOT NULL,   -- ad account id (e.g. act_123456789)
    meta_campaign_id     NVARCHAR(64)  NOT NULL,   -- campaign id
    campaign_name        NVARCHAR(512) NULL,
    campaign_status      NVARCHAR(40)  NULL,       -- ACTIVE | PAUSED | ARCHIVED | DELETED
    objective            NVARCHAR(100) NULL,       -- LINK_CLICKS | CONVERSIONS | etc.
    created_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_mac_created DEFAULT (SYSUTCDATETIME()),
    updated_at           DATETIME2(3)  NOT NULL CONSTRAINT DF_mac_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_mac_account_campaign UNIQUE (meta_account_id, meta_campaign_id)
  );
  CREATE INDEX IX_mac_platform_account ON dbo.meta_ads_campaigns (platform_account_id);
  CREATE INDEX IX_mac_client ON dbo.meta_ads_campaigns (client_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'meta_ads_campaign_daily_metrics')
BEGIN
  CREATE TABLE dbo.meta_ads_campaign_daily_metrics (
    id                   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_macdm PRIMARY KEY,
    campaign_id          INT            NOT NULL
                           CONSTRAINT FK_macdm_campaign REFERENCES dbo.meta_ads_campaigns(id),
    metric_date          DATE           NOT NULL,
    impressions          BIGINT         NOT NULL CONSTRAINT DF_macdm_impr DEFAULT (0),
    clicks               BIGINT         NOT NULL CONSTRAINT DF_macdm_clicks DEFAULT (0),
    reach                BIGINT         NULL,
    spend                DECIMAL(18,2)  NOT NULL CONSTRAINT DF_macdm_spend DEFAULT (0),
    conversions          DECIMAL(18,4)  NOT NULL CONSTRAINT DF_macdm_conv DEFAULT (0),
    conversions_value    DECIMAL(18,4)  NOT NULL CONSTRAINT DF_macdm_convval DEFAULT (0),
    ctr                  DECIMAL(9,6)   NULL,
    cpc                  DECIMAL(18,4)  NULL,
    cost_per_conversion  DECIMAL(18,4)  NULL,
    raw_payload_json     NVARCHAR(MAX)  NULL,
    created_at           DATETIME2(3)   NOT NULL CONSTRAINT DF_macdm_created DEFAULT (SYSUTCDATETIME()),
    updated_at           DATETIME2(3)   NOT NULL CONSTRAINT DF_macdm_updated DEFAULT (SYSUTCDATETIME()),
    last_synced_at       DATETIME2(3)   NOT NULL CONSTRAINT DF_macdm_synced DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_macdm_campaign_date UNIQUE (campaign_id, metric_date)
  );
  CREATE INDEX IX_macdm_date ON dbo.meta_ads_campaign_daily_metrics (metric_date);
  CREATE INDEX IX_macdm_campaign_date ON dbo.meta_ads_campaign_daily_metrics (campaign_id, metric_date);
END
GO
