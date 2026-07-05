-- 0010_news_calendar.sql
-- News Insights: keyword management + news feed cache
-- Campaign Calendar: manual calendar events

-- ── news_keywords ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'news_keywords')
BEGIN
  CREATE TABLE dbo.news_keywords (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_news_keywords PRIMARY KEY,
    keyword     NVARCHAR(200)     NOT NULL,
    client_id   INT               NULL
                  CONSTRAINT FK_news_keywords_client REFERENCES dbo.clients(id) ON DELETE SET NULL,
    active      BIT               NOT NULL CONSTRAINT DF_news_keywords_active DEFAULT (1),
    created_by  INT               NOT NULL
                  CONSTRAINT FK_news_keywords_user REFERENCES dbo.users(id),
    created_at  DATETIME2(3)      NOT NULL CONSTRAINT DF_news_keywords_created DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_news_keywords_kw_client UNIQUE (keyword, client_id)
  );
  CREATE INDEX IX_news_keywords_client ON dbo.news_keywords (client_id);
END
GO

-- ── news_feed_cache ────────────────────────────────────────────────────────────
-- Stores AI-processed news articles keyed by a hash of the active keyword set.
-- TTL 4 hours for news feed, 7 days for marketing calendar (same table, different key prefix).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'news_feed_cache')
BEGIN
  CREATE TABLE dbo.news_feed_cache (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_news_feed_cache PRIMARY KEY,
    cache_key     NVARCHAR(128)     NOT NULL CONSTRAINT UQ_news_feed_cache_key UNIQUE,
    articles_json NVARCHAR(MAX)     NOT NULL,
    fetched_at    DATETIME2(3)      NOT NULL CONSTRAINT DF_news_feed_cache_fetched DEFAULT (SYSUTCDATETIME()),
    expires_at    DATETIME2(3)      NOT NULL
  );
  CREATE INDEX IX_news_feed_cache_expires ON dbo.news_feed_cache (expires_at);
END
GO

-- ── calendar_events ───────────────────────────────────────────────────────────
-- Manually-added calendar events (complements auto-derived campaign/approval events).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'calendar_events')
BEGIN
  CREATE TABLE dbo.calendar_events (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_calendar_events PRIMARY KEY,
    title       NVARCHAR(200)     NOT NULL,
    start_date  DATE              NOT NULL,
    end_date    DATE              NULL,
    all_day     BIT               NOT NULL CONSTRAINT DF_calendar_events_allday DEFAULT (1),
    client_id   INT               NULL
                  CONSTRAINT FK_calendar_events_client REFERENCES dbo.clients(id) ON DELETE SET NULL,
    color       NVARCHAR(20)      NULL,
    notes       NVARCHAR(1000)    NULL,
    created_by  INT               NOT NULL
                  CONSTRAINT FK_calendar_events_user REFERENCES dbo.users(id),
    created_at  DATETIME2(3)      NOT NULL CONSTRAINT DF_calendar_events_created DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_calendar_events_dates ON dbo.calendar_events (start_date, end_date);
  CREATE INDEX IX_calendar_events_client ON dbo.calendar_events (client_id);
END
GO
