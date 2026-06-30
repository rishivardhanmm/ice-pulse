-- =====================================================================
-- ICE Pulse — Migration 0002: AI usage tracking
-- ---------------------------------------------------------------------
-- One row per AI API call, with token counts and the estimated USD cost,
-- so spend can be monitored. Idempotent.
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_usage')
BEGIN
  CREATE TABLE dbo.ai_usage (
    id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ai_usage PRIMARY KEY,
    feature             NVARCHAR(40)   NOT NULL,   -- 'insights' | 'ask' | 'campaign'
    provider            NVARCHAR(40)   NOT NULL,   -- 'openai'
    model               NVARCHAR(80)   NOT NULL,   -- e.g. 'gpt-4o-mini'
    prompt_tokens       INT            NOT NULL CONSTRAINT DF_ai_usage_pt DEFAULT (0),
    completion_tokens   INT            NOT NULL CONSTRAINT DF_ai_usage_ct DEFAULT (0),
    total_tokens        INT            NOT NULL CONSTRAINT DF_ai_usage_tt DEFAULT (0),
    estimated_cost_usd  DECIMAL(12,6)  NOT NULL CONSTRAINT DF_ai_usage_cost DEFAULT (0),
    meta_json           NVARCHAR(MAX)  NULL,
    created_at          DATETIME2(3)   NOT NULL CONSTRAINT DF_ai_usage_created DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_ai_usage_created ON dbo.ai_usage (created_at DESC);
  CREATE INDEX IX_ai_usage_feature ON dbo.ai_usage (feature);
END
GO
