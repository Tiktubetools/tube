-- 0000_init.sql: Initial Schema Migration for TikTube Tools relational PostgreSQL database

CREATE TABLE IF NOT EXISTS visits (
  id VARCHAR(64) PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT NOT NULL,
  page_url VARCHAR(256) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(32) NOT NULL, -- 'ad_impression', 'ad_click', 'tool_usage', 'login', 'register'
  event_name VARCHAR(128) NOT NULL,
  user_id VARCHAR(64) DEFAULT 'guest' NOT NULL,
  metadata TEXT, -- JSON text
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  id VARCHAR(64) PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  visits INTEGER DEFAULT 0 NOT NULL,
  unique_visitors INTEGER DEFAULT 0 NOT NULL,
  page_views INTEGER DEFAULT 0 NOT NULL,
  ad_impressions INTEGER DEFAULT 0 NOT NULL,
  ad_clicks INTEGER DEFAULT 0 NOT NULL,
  ctr NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
  tool_usage INTEGER DEFAULT 0 NOT NULL,
  registrations INTEGER DEFAULT 0 NOT NULL,
  logins INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(512) NOT NULL,
  title_ar VARCHAR(512) NOT NULL,
  excerpt TEXT,
  excerpt_ar TEXT,
  content TEXT,
  content_ar TEXT,
  author VARCHAR(128) NOT NULL,
  author_ar VARCHAR(128) NOT NULL,
  date DATE NOT NULL,
  read_time VARCHAR(64) DEFAULT '5 min read' NOT NULL,
  read_time_ar VARCHAR(64) DEFAULT 'قراءة في 5 دقائق' NOT NULL,
  tags TEXT[], -- array of text for tags
  banner_url VARCHAR(512) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indices for ultra-fast query times on analytics dashboard analytics
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_created_at ON events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stats_date ON stats (date DESC);
