-- 0008_team_roles_approvals.sql
-- Admin-defined "team role" job titles for internal staff (separate axis from the
-- fixed admin|internal|client system role), plus a generic content-approval workflow.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'team_roles')
BEGIN
  CREATE TABLE dbo.team_roles (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_team_roles PRIMARY KEY,
    name         NVARCHAR(100) NOT NULL,
    can_approve  BIT           NOT NULL CONSTRAINT DF_team_roles_can_approve DEFAULT (0),
    created_at   DATETIME2(3)  NOT NULL CONSTRAINT DF_team_roles_created DEFAULT (SYSUTCDATETIME()),
    updated_at   DATETIME2(3)  NOT NULL CONSTRAINT DF_team_roles_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_team_roles_name UNIQUE (name)
  );
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'team_role_id'
)
BEGIN
  ALTER TABLE dbo.users
    ADD team_role_id INT NULL
        CONSTRAINT FK_users_team_role FOREIGN KEY REFERENCES dbo.team_roles (id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'approval_submissions')
BEGIN
  CREATE TABLE dbo.approval_submissions (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_approval_submissions PRIMARY KEY,
    submission_type  NVARCHAR(30)   NOT NULL CONSTRAINT DF_as_type DEFAULT ('content_image'),
    client_id        INT            NULL CONSTRAINT FK_as_client REFERENCES dbo.clients(id),
    campaign_id      INT            NULL CONSTRAINT FK_as_campaign REFERENCES dbo.google_ads_campaigns(id),
    title            NVARCHAR(200)  NULL,
    caption          NVARCHAR(2000) NULL,
    image_path       NVARCHAR(500)  NULL,
    canva_design_id  NVARCHAR(100)  NULL,
    status           NVARCHAR(20)   NOT NULL CONSTRAINT DF_as_status DEFAULT ('pending'),
    submitted_by     INT            NOT NULL CONSTRAINT FK_as_submitted_by REFERENCES dbo.users(id),
    decided_by       INT            NULL CONSTRAINT FK_as_decided_by REFERENCES dbo.users(id),
    decided_at       DATETIME2(3)   NULL,
    created_at       DATETIME2(3)   NOT NULL CONSTRAINT DF_as_created DEFAULT (SYSUTCDATETIME()),
    updated_at       DATETIME2(3)   NOT NULL CONSTRAINT DF_as_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_approval_submissions_status CHECK (status IN ('pending','approved','rejected'))
  );
  CREATE INDEX IX_approval_submissions_status ON dbo.approval_submissions (status);
  CREATE INDEX IX_approval_submissions_client ON dbo.approval_submissions (client_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'approval_events')
BEGIN
  CREATE TABLE dbo.approval_events (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_approval_events PRIMARY KEY,
    submission_id   INT NOT NULL
                      CONSTRAINT FK_ae_submission REFERENCES dbo.approval_submissions(id) ON DELETE CASCADE,
    event_type      NVARCHAR(20) NOT NULL,
    comment         NVARCHAR(2000) NULL,
    actor_id        INT NOT NULL CONSTRAINT FK_ae_actor REFERENCES dbo.users(id),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_ae_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_approval_events_type
      CHECK (event_type IN ('submitted','comment','approved','rejected','resubmitted'))
  );
  CREATE INDEX IX_approval_events_submission ON dbo.approval_events (submission_id, created_at);
END
GO
