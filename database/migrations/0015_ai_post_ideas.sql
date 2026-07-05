-- 0015_ai_post_ideas.sql
-- Daily AI-generated social post ideas: caption + hashtags + a designer-ready
-- image brief (image production stays with the design team in the ICE brand
-- templates — Canva autofill needs Enterprise, which ICE doesn't have).

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ai_post_ideas')
BEGIN
  CREATE TABLE dbo.ai_post_ideas (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ai_post_ideas PRIMARY KEY,
    idea_date    DATE           NOT NULL,
    platform     NVARCHAR(20)   NOT NULL,   -- 'facebook' | 'instagram' | 'linkedin'
    caption      NVARCHAR(1000) NOT NULL,
    hashtags     NVARCHAR(400)  NULL,
    image_brief  NVARCHAR(1000) NULL,       -- direction for the designer (ICE brand template)
    news_hook    NVARCHAR(500)  NULL,       -- the news angle it rides on, if any
    created_at   DATETIME2(3)   NOT NULL CONSTRAINT DF_api_created DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_ai_post_ideas_date ON dbo.ai_post_ideas (idea_date DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.sync_schedules WHERE source = 'daily_post_ideas')
  INSERT INTO dbo.sync_schedules (source, enabled, interval_minutes, lookback_days)
  VALUES ('daily_post_ideas', 1, 1440, 1);   -- once a day
GO
