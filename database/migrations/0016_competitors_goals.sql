-- 0016_competitors_goals.sql
-- Competitor watch: mark news keywords as competitor names so the AI writes
-- "how our clients could respond" angles for stories about them.
-- Client goals: a monthly conversion target per client, shown as progress on
-- their dashboard next to budget pacing.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.news_keywords') AND name = 'is_competitor'
)
BEGIN
  ALTER TABLE dbo.news_keywords
    ADD is_competitor BIT NOT NULL CONSTRAINT DF_nk_competitor DEFAULT (0);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.client_budget') AND name = 'monthly_conversion_goal'
)
BEGIN
  ALTER TABLE dbo.client_budget
    ADD monthly_conversion_goal DECIMAL(18,2) NULL;
END
GO
