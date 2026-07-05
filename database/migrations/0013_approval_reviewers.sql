-- 0013_approval_reviewers.sql
-- Named reviewers per approval submission: the submitter picks WHO should
-- review. When a submission has named reviewers, only they (or a system
-- admin) may decide it, and only they are notified.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'approval_reviewers')
BEGIN
  CREATE TABLE dbo.approval_reviewers (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_approval_reviewers PRIMARY KEY,
    submission_id  INT NOT NULL
                     CONSTRAINT FK_ar_submission REFERENCES dbo.approval_submissions(id) ON DELETE CASCADE,
    user_id        INT NOT NULL CONSTRAINT FK_ar_user REFERENCES dbo.users(id),
    created_at     DATETIME2(3) NOT NULL CONSTRAINT DF_ar_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_approval_reviewers UNIQUE (submission_id, user_id)
  );
  CREATE INDEX IX_approval_reviewers_user ON dbo.approval_reviewers (user_id);
END
GO
