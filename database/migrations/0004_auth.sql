-- =====================================================================
-- ICE Pulse — Migration 0004: auth + client assignment
-- ---------------------------------------------------------------------
-- Adds per-user login support and allows assigning campaigns to clients.
-- Idempotent: every change is guarded and safe to re-run.
-- =====================================================================

-- ── users ────────────────────────────────────────────────────────────
-- Internal ICE staff and external client contacts.
-- client_id NULL  → admin or internal (can see all data)
-- client_id = N   → external client (scoped to that client only)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'users')
BEGIN
  CREATE TABLE dbo.users (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    email          NVARCHAR(254)     NOT NULL,
    password_hash  NVARCHAR(512)     NOT NULL,
    name           NVARCHAR(200)     NOT NULL,
    role           NVARCHAR(20)      NOT NULL CONSTRAINT DF_users_role DEFAULT ('internal'),
                   -- 'admin' | 'internal' | 'client'
    client_id      INT               NULL,
    is_active      BIT               NOT NULL CONSTRAINT DF_users_active DEFAULT (1),
    created_at     DATETIME2(3)      NOT NULL CONSTRAINT DF_users_created DEFAULT (SYSUTCDATETIME()),
    updated_at     DATETIME2(3)      NOT NULL CONSTRAINT DF_users_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT FK_users_client FOREIGN KEY (client_id) REFERENCES dbo.clients (id),
    CONSTRAINT CK_users_role CHECK (role IN ('admin', 'internal', 'client'))
  );
  CREATE INDEX IX_users_client ON dbo.users (client_id);
END
GO

-- ── google_ads_campaigns: add client_id ──────────────────────────────
-- NULL  = unassigned / ICE-internal only
-- Set   = this campaign belongs to that external client's view
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.google_ads_campaigns') AND name = 'client_id'
)
BEGIN
  ALTER TABLE dbo.google_ads_campaigns
    ADD client_id INT NULL
        CONSTRAINT FK_gac_client FOREIGN KEY REFERENCES dbo.clients (id);
  CREATE INDEX IX_gac_client ON dbo.google_ads_campaigns (client_id);
END
GO
