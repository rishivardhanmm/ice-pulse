-- 0014_client_budget_amount.sql
-- Real monthly budget AMOUNT per client (account currency), enabling computed
-- budget pacing (spend-to-date, run rate, projected month-end) instead of the
-- manually maintained pct_used. pct_used stays as a fallback display for
-- clients whose amount has not been set yet.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.client_budget') AND name = 'monthly_budget'
)
BEGIN
  ALTER TABLE dbo.client_budget
    ADD monthly_budget DECIMAL(18,2) NULL;
END
GO
