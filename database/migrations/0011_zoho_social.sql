-- ============================================================
-- 0011 — Zoho Social integration
-- ============================================================
-- zoho_social_connections   OAuth token store (one active connection)
-- zoho_social_brands        Brands within the Zoho Social org
-- zoho_social_profiles      Social profiles per brand/network
-- zoho_social_posts         Published posts + performance metrics
-- zoho_scheduled_posts      Upcoming scheduled posts (for Campaign Calendar)
-- ============================================================

-- ── 1. OAuth connection ────────────────────────────────────────────────
CREATE TABLE dbo.zoho_social_connections (
  id                      INT IDENTITY(1,1) PRIMARY KEY,
  org_id                  NVARCHAR(64)  NOT NULL,
  access_token_encrypted  NVARCHAR(MAX) NOT NULL,
  refresh_token_encrypted NVARCHAR(MAX) NULL,
  token_enc_version       NVARCHAR(10)  NOT NULL DEFAULT 'plain',
  expires_at              DATETIME2(3)  NULL,
  scopes                  NVARCHAR(500) NULL,
  status                  NVARCHAR(20)  NOT NULL DEFAULT 'connected'
    CONSTRAINT CK_zsc_status CHECK (status IN ('connected','expired','disconnected')),
  connected_by            INT           NOT NULL REFERENCES dbo.users(id),
  connected_at            DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  last_refreshed_at       DATETIME2(3)  NULL
);

-- ── 2. Brands ──────────────────────────────────────────────────────────
CREATE TABLE dbo.zoho_social_brands (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  connection_id   INT           NOT NULL REFERENCES dbo.zoho_social_connections(id) ON DELETE CASCADE,
  zoho_brand_id   NVARCHAR(64)  NOT NULL,
  name            NVARCHAR(200) NOT NULL,
  logo_url        NVARCHAR(500) NULL,
  client_id       INT           NULL REFERENCES dbo.clients(id) ON DELETE SET NULL,
  synced_at       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_zsb_brand UNIQUE (connection_id, zoho_brand_id)
);

-- ── 3. Social profiles ─────────────────────────────────────────────────
CREATE TABLE dbo.zoho_social_profiles (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  brand_id         INT           NOT NULL REFERENCES dbo.zoho_social_brands(id) ON DELETE CASCADE,
  zoho_profile_id  NVARCHAR(64)  NOT NULL,
  network          NVARCHAR(30)  NOT NULL,  -- 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok'
  profile_name     NVARCHAR(200) NOT NULL,
  profile_url      NVARCHAR(500) NULL,
  follower_count   INT           NULL,
  synced_at        DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_zsp_profile UNIQUE (brand_id, zoho_profile_id)
);

-- ── 4. Published posts + metrics ───────────────────────────────────────
CREATE TABLE dbo.zoho_social_posts (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  profile_id       INT           NOT NULL REFERENCES dbo.zoho_social_profiles(id) ON DELETE CASCADE,
  zoho_post_id     NVARCHAR(64)  NOT NULL UNIQUE,
  network          NVARCHAR(30)  NOT NULL,
  content_text     NVARCHAR(4000) NULL,
  media_urls_json  NVARCHAR(MAX) NULL,       -- JSON array of image/video URLs
  post_type        NVARCHAR(20)  NOT NULL DEFAULT 'text',  -- 'image'|'video'|'text'|'link'|'carousel'|'reel'
  permalink_url    NVARCHAR(500) NULL,
  published_at     DATETIME2(3)  NOT NULL,
  impressions      INT           NOT NULL DEFAULT 0,
  reach            INT           NOT NULL DEFAULT 0,
  likes            INT           NOT NULL DEFAULT 0,
  comments         INT           NOT NULL DEFAULT 0,
  shares           INT           NOT NULL DEFAULT 0,
  clicks           INT           NOT NULL DEFAULT 0,
  engagement_rate  DECIMAL(10,4) NULL,       -- (likes+comments+shares) / reach * 100
  raw_payload_json NVARCHAR(MAX) NULL,
  created_at       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_zoho_posts_published ON dbo.zoho_social_posts (published_at DESC);
CREATE INDEX IX_zoho_posts_profile   ON dbo.zoho_social_posts (profile_id, published_at DESC);

-- ── 5. Scheduled / draft posts (for Campaign Calendar) ────────────────
CREATE TABLE dbo.zoho_scheduled_posts (
  id               INT IDENTITY(1,1) PRIMARY KEY,
  profile_id       INT           NOT NULL REFERENCES dbo.zoho_social_profiles(id) ON DELETE CASCADE,
  zoho_post_id     NVARCHAR(64)  NOT NULL UNIQUE,
  network          NVARCHAR(30)  NOT NULL,
  content_text     NVARCHAR(4000) NULL,
  scheduled_at     DATETIME2(3)  NOT NULL,
  status           NVARCHAR(20)  NOT NULL DEFAULT 'scheduled'
    CONSTRAINT CK_zschd_status CHECK (status IN ('scheduled','published','failed','cancelled')),
  created_at       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_zoho_scheduled_at ON dbo.zoho_scheduled_posts (scheduled_at);
