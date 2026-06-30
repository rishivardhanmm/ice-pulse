-- 0005_budget.sql
-- Adds client_budget table: a manually-set budget utilisation % per client.
-- ICE staff sets this number (0-100); it is shown to the client on their dashboard.

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
