// /src/db/schema.ts: Structured SQL relational database schema mapping (Drizzle/Prisma compatible)

/**
 * visits schema
 * Tracks each unique raw visits payload to TikTube Tools
 */
export interface VisitSchema {
  id: string; // Primary Key
  ip_address: string;
  user_agent: string;
  page_url: string;
  created_at: string; // ISO DateTime
}

/**
 * events schema
 * Tracks critical actions: clicks, impressions, logins, registrations, and tool usage
 */
export interface EventSchema {
  id: string; // Primary Key
  event_type: "ad_impression" | "ad_click" | "tool_usage" | "login" | "register";
  event_name: string; // e.g., 'use_yt-thumbnail'
  user_id: string; // 'guest' or actual user ID
  metadata: Record<string, any>; // JSON string in databases
  created_at: string; // ISO DateTime
}

/**
 * stats schema
 * Aggregate daily snapshots computed from visits and events records
 */
export interface StatSchema {
  id: string; // Primary key e.g., 'stats-2026-06-07'
  date: string; // unique date (YYYY-MM-DD)
  visits: number;
  unique_visitors: number;
  page_views: number;
  ad_impressions: number;
  ad_clicks: number;
  ctr: number; // Click-Through Rate (%)
  tool_usage: number;
  registrations: number;
  logins: number;
}

/**
 * blog_posts schema
 * Local database of blogging posts synchronized from WordPress or published via panel
 */
export interface BlogPostSchema {
  id: string; // Primary Key (looks like 'wp-1024' or 'post-1717')
  title: string;
  title_ar: string;
  excerpt: string;
  excerpt_ar: string;
  content: string;
  content_ar: string;
  author: string;
  author_ar: string;
  date: string; // YYYY-MM-DD
  read_time: string;
  read_time_ar: string;
  tags: string[]; // tags arrays map as text arrays
  banner_url: string;
  created_at?: string;
}
