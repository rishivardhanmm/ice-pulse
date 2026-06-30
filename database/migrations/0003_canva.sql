-- =====================================================================
-- ICE Pulse — Migration 0003: Canva Connect integration (internal)
-- ---------------------------------------------------------------------
-- Foundation tables for the internal Canva integration: the OAuth
-- connection, encrypted tokens, the connected account's capabilities,
-- synced brand/design templates, generated designs, and export jobs.
--
-- Pulse has no end-user/auth system, so a connection is keyed by an
-- optional free-text `internal_account_id` label (single-tenant: there
-- is normally one active connection). Tokens are stored ENCRYPTED only
-- (never plain text) by the token service. Idempotent.
-- =====================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'canva_connections')
BEGIN
  CREATE TABLE dbo.canva_connections (
    id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_canva_connections PRIMARY KEY,
    internal_account_id NVARCHAR(100)  NULL,                         -- optional label (no user system)
    canva_user_id       NVARCHAR(255)  NULL,
    canva_team_id       NVARCHAR(255)  NULL,
    canva_email         NVARCHAR(320)  NULL,
    canva_display_name  NVARCHAR(255)  NULL,
    connection_status   NVARCHAR(30)   NOT NULL CONSTRAINT DF_canva_conn_status DEFAULT ('connected'),
                                                                     -- connected | disconnected | expired | revoked | error
    scopes              NVARCHAR(MAX)  NULL,                         -- granted scopes (space-separated)
    connected_at        DATETIME2(3)   NULL,
    last_refreshed_at   DATETIME2(3)   NULL,
    created_at          DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_conn_created DEFAULT (SYSUTCDATETIME()),
    updated_at          DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_conn_updated DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_canva_connections_status ON dbo.canva_connections (connection_status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'canva_oauth_tokens')
BEGIN
  CREATE TABLE dbo.canva_oauth_tokens (
    id                      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_canva_oauth_tokens PRIMARY KEY,
    connection_id           INT            NOT NULL,
    access_token_encrypted  NVARCHAR(MAX)  NOT NULL,                 -- ENCRYPTED, never plain text
    refresh_token_encrypted NVARCHAR(MAX)  NULL,                     -- ENCRYPTED, never plain text
    token_enc_version       NVARCHAR(20)   NOT NULL CONSTRAINT DF_canva_tok_encver DEFAULT ('v1'),
    expires_at              DATETIME2(3)   NULL,
    scopes                  NVARCHAR(MAX)  NULL,
    created_at              DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_tok_created DEFAULT (SYSUTCDATETIME()),
    updated_at              DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_tok_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_canva_tokens_conn FOREIGN KEY (connection_id)
      REFERENCES dbo.canva_connections (id) ON DELETE CASCADE
  );
  -- One token row per connection.
  CREATE UNIQUE INDEX UX_canva_tokens_conn ON dbo.canva_oauth_tokens (connection_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'canva_capabilities')
BEGIN
  CREATE TABLE dbo.canva_capabilities (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_canva_capabilities PRIMARY KEY,
    connection_id   INT            NOT NULL,
    capability_name NVARCHAR(80)   NOT NULL,                         -- autofill | brand_template | resize | ...
    is_available    BIT            NOT NULL CONSTRAINT DF_canva_cap_avail DEFAULT (0),
    checked_at      DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_cap_checked DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_canva_caps_conn FOREIGN KEY (connection_id)
      REFERENCES dbo.canva_connections (id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX UX_canva_caps_conn_name ON dbo.canva_capabilities (connection_id, capability_name);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'canva_templates')
BEGIN
  CREATE TABLE dbo.canva_templates (
    id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_canva_templates PRIMARY KEY,
    connection_id     INT            NOT NULL,
    canva_template_id NVARCHAR(255)  NOT NULL,
    title             NVARCHAR(500)  NULL,
    thumbnail_url     NVARCHAR(2000) NULL,
    template_type     NVARCHAR(80)   NULL,
    source            NVARCHAR(40)   NOT NULL CONSTRAINT DF_canva_tpl_source DEFAULT ('brand_template'),
    last_synced_at    DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_tpl_synced DEFAULT (SYSUTCDATETIME()),
    created_at        DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_tpl_created DEFAULT (SYSUTCDATETIME()),
    updated_at        DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_tpl_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_canva_templates_conn FOREIGN KEY (connection_id)
      REFERENCES dbo.canva_connections (id) ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX UX_canva_templates_conn_tpl ON dbo.canva_templates (connection_id, canva_template_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'canva_designs')
BEGIN
  CREATE TABLE dbo.canva_designs (
    id                       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_canva_designs PRIMARY KEY,
    connection_id            INT            NOT NULL,
    client_id                INT            NULL,                    -- logical ref to dbo.clients(id)
    campaign_id              INT            NULL,                    -- logical ref to dbo.google_ads_campaigns(id)
    canva_design_id          NVARCHAR(255)  NOT NULL,
    title                    NVARCHAR(500)  NULL,
    design_url               NVARCHAR(2000) NULL,
    thumbnail_url            NVARCHAR(2000) NULL,
    status                   NVARCHAR(30)   NOT NULL CONSTRAINT DF_canva_design_status DEFAULT ('created'),
    created_from_template_id NVARCHAR(255)  NULL,
    created_at               DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_design_created DEFAULT (SYSUTCDATETIME()),
    updated_at               DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_design_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_canva_designs_conn FOREIGN KEY (connection_id)
      REFERENCES dbo.canva_connections (id) ON DELETE CASCADE
  );
  CREATE INDEX IX_canva_designs_conn ON dbo.canva_designs (connection_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'canva_export_jobs')
BEGIN
  CREATE TABLE dbo.canva_export_jobs (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_canva_export_jobs PRIMARY KEY,
    design_id       INT            NOT NULL,
    canva_export_id NVARCHAR(255)  NULL,
    export_format   NVARCHAR(20)   NOT NULL,                         -- pdf | png | jpg | ...
    status          NVARCHAR(30)   NOT NULL CONSTRAINT DF_canva_exp_status DEFAULT ('in_progress'),
                                                                     -- in_progress | success | failed
    download_url    NVARCHAR(2000) NULL,                            -- short-lived Canva URL (kept internal)
    error_message   NVARCHAR(1000) NULL,
    created_at      DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_exp_created DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3)   NOT NULL CONSTRAINT DF_canva_exp_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_canva_exports_design FOREIGN KEY (design_id)
      REFERENCES dbo.canva_designs (id) ON DELETE CASCADE
  );
  CREATE INDEX IX_canva_exports_design ON dbo.canva_export_jobs (design_id);
END
GO
