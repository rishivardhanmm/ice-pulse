-- 0006_client_budget.sql
-- Replaces the old per-campaign budget table with a per-client one.
-- ICE staff manually sets a budget utilisation % (0-100) per client;
-- it is shown to the client on their dashboard.

-- Drop old per-campaign table if it was created by an earlier migration draft
IF OBJECT_ID('dbo.campaign_budgets') IS NOT NULL
  DROP TABLE dbo.campaign_budgets;

IF OBJECT_ID('dbo.client_budget') IS NULL
BEGIN
  CREATE TABLE dbo.client_budget (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    client_id   INT          NOT NULL UNIQUE
                  REFERENCES dbo.clients(id) ON DELETE CASCADE,
    pct_used    INT          NOT NULL CHECK (pct_used BETWEEN 0 AND 100),
    notes       NVARCHAR(500) NULL,
    set_by      INT          NULL REFERENCES dbo.users(id),
    updated_at  DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
