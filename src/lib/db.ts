import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const DB_PATH = resolve(process.cwd(), "data", "twitter-machine.db");

let _db: ReturnType<typeof drizzle> | null = null;

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS voice_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      context TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS target_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL UNIQUE,
      notes TEXT,
      engagement_mode TEXT NOT NULL DEFAULT 'engage',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      thread_parts TEXT,
      source_url TEXT,
      source_text TEXT,
      source_handle TEXT,
      angle TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_for INTEGER,
      posted_at INTEGER,
      impressions INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      retweets INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      metrics_updated_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
    CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at);
    CREATE INDEX IF NOT EXISTS idx_drafts_scheduled_for ON drafts(scheduled_for);
  `);

  // Idempotent migrations for installs created before later columns existed.
  const cols = sqlite
    .prepare("PRAGMA table_info(drafts)")
    .all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  const addColumn = (name: string, ddl: string) => {
    if (!have.has(name)) sqlite.exec(`ALTER TABLE drafts ADD COLUMN ${ddl}`);
  };
  addColumn("thread_parts", "thread_parts TEXT");
  addColumn("posted_at", "posted_at INTEGER");
  addColumn("impressions", "impressions INTEGER NOT NULL DEFAULT 0");
  addColumn("likes", "likes INTEGER NOT NULL DEFAULT 0");
  addColumn("retweets", "retweets INTEGER NOT NULL DEFAULT 0");
  addColumn("replies", "replies INTEGER NOT NULL DEFAULT 0");
  addColumn("metrics_updated_at", "metrics_updated_at INTEGER");
}

export function getDb() {
  if (_db) return _db;
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  _db = drizzle(sqlite);
  return _db;
}
