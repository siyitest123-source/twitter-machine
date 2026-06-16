import { existsSync, mkdirSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// Default to ~/.twitter-factory/ which lives OUTSIDE the project tree.
// Keeping the SQLite DB outside the repo is essential under Turbopack 16 —
// its file watcher reacts to SQLite's WAL/SHM churn and pegs the dev server
// to 1000%+ CPU otherwise. Override with TWITTER_FACTORY_DB_PATH if you
// want the DB somewhere else (e.g. shared volume in production).
const DEFAULT_DB_DIR = join(homedir(), ".twitter-factory");
const DB_PATH =
  process.env.TWITTER_FACTORY_DB_PATH ??
  join(DEFAULT_DB_DIR, "twitter-machine.db");

// One-shot migration for installs that still have data at the old in-repo
// location ./data/twitter-machine.db. If the new DB doesn't exist yet but
// the old one does, move it (along with WAL/SHM siblings) so existing
// training survives the upgrade.
const LEGACY_DB_PATH = resolve(process.cwd(), "data", "twitter-machine.db");
function migrateLegacyLocation() {
  if (existsSync(DB_PATH)) return;
  if (!existsSync(LEGACY_DB_PATH)) return;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  for (const suffix of ["", "-shm", "-wal"]) {
    const from = LEGACY_DB_PATH + suffix;
    const to = DB_PATH + suffix;
    if (existsSync(from)) {
      try {
        renameSync(from, to);
      } catch {
        /* best-effort */
      }
    }
  }
}

let _db: ReturnType<typeof drizzle> | null = null;

function columnNames(sqlite: Database.Database, table: string): Set<string> {
  const cols = sqlite
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  return new Set(cols.map((c) => c.name));
}

function ensureSchema(sqlite: Database.Database) {
  // Fresh-install shapes. CREATE IF NOT EXISTS is a no-op for existing
  // installs; the migration block below upgrades those in place.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handle TEXT NOT NULL UNIQUE,
      display_name TEXT,
      persona TEXT,
      typefully_api_key TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS voice_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      text TEXT NOT NULL,
      context TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS target_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      handle TEXT NOT NULL,
      notes TEXT,
      engagement_mode TEXT NOT NULL DEFAULT 'engage',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(account_id, handle)
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      thread_parts TEXT,
      source_url TEXT,
      source_text TEXT,
      source_handle TEXT,
      angle TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_for INTEGER,
      image_url TEXT,
      image_prompt TEXT,
      posted_at INTEGER,
      impressions INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      retweets INTEGER NOT NULL DEFAULT 0,
      replies INTEGER NOT NULL DEFAULT 0,
      metrics_updated_at INTEGER,
      typefully_draft_id TEXT,
      typefully_url TEXT,
      typefully_sent_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS discovered_tweets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      source_tweet_id TEXT NOT NULL,
      source_handle TEXT,
      source_url TEXT,
      source_text TEXT NOT NULL,
      tweet_created_at INTEGER,
      likes INTEGER NOT NULL DEFAULT 0,
      retweets INTEGER NOT NULL DEFAULT 0,
      relevance INTEGER NOT NULL DEFAULT 0,
      reply_draft TEXT,
      qrt_draft TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      scanned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(account_id, source_tweet_id)
    );

    CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
    CREATE INDEX IF NOT EXISTS idx_drafts_created_at ON drafts(created_at);
    CREATE INDEX IF NOT EXISTS idx_drafts_scheduled_for ON drafts(scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_disc_account_status ON discovered_tweets(account_id, status);
  `);
  // NOTE: account_id indexes are created at the end of migrateToMultiAccount,
  // after the columns are guaranteed to exist (an existing install won't have
  // them yet at this point).

  // --- Pre-multi-account column migrations on drafts (metrics, threads) ---
  const draftCols = columnNames(sqlite, "drafts");
  const addDraftColumn = (name: string, ddl: string) => {
    if (!draftCols.has(name)) {
      sqlite.exec(`ALTER TABLE drafts ADD COLUMN ${ddl}`);
      draftCols.add(name);
    }
  };
  addDraftColumn("thread_parts", "thread_parts TEXT");
  addDraftColumn("posted_at", "posted_at INTEGER");
  addDraftColumn("impressions", "impressions INTEGER NOT NULL DEFAULT 0");
  addDraftColumn("likes", "likes INTEGER NOT NULL DEFAULT 0");
  addDraftColumn("retweets", "retweets INTEGER NOT NULL DEFAULT 0");
  addDraftColumn("replies", "replies INTEGER NOT NULL DEFAULT 0");
  addDraftColumn("metrics_updated_at", "metrics_updated_at INTEGER");
  addDraftColumn("image_url", "image_url TEXT");
  addDraftColumn("image_prompt", "image_prompt TEXT");
  addDraftColumn("typefully_draft_id", "typefully_draft_id TEXT");
  addDraftColumn("typefully_url", "typefully_url TEXT");
  addDraftColumn("typefully_sent_at", "typefully_sent_at INTEGER");

  // Idempotent migration for the accounts.typefully_api_key column.
  const acctCols = columnNames(sqlite, "accounts");
  if (!acctCols.has("typefully_api_key")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN typefully_api_key TEXT");
  }

  migrateToMultiAccount(sqlite);
}

/**
 * Non-destructive migration to multi-account. Adds account_id to the data
 * tables, folds any pre-existing (single-account) data into a "Main" account
 * so nothing is lost, and rebuilds target_accounts to drop the global
 * UNIQUE(handle) in favor of UNIQUE(account_id, handle).
 */
function migrateToMultiAccount(sqlite: Database.Database) {
  const voiceCols = columnNames(sqlite, "voice_samples");
  const targetCols = columnNames(sqlite, "target_accounts");
  const draftCols = columnNames(sqlite, "drafts");

  const voiceNeedsAccount = !voiceCols.has("account_id");
  const draftsNeedsAccount = !draftCols.has("account_id");
  const targetsNeedsRebuild = !targetCols.has("account_id");

  if (voiceNeedsAccount) {
    sqlite.exec("ALTER TABLE voice_samples ADD COLUMN account_id INTEGER");
  }
  if (draftsNeedsAccount) {
    sqlite.exec("ALTER TABLE drafts ADD COLUMN account_id INTEGER");
  }

  // Is there any legacy data that predates accounts?
  const hasOrphans =
    (sqlite
      .prepare("SELECT count(*) c FROM voice_samples WHERE account_id IS NULL")
      .get() as { c: number }).c > 0 ||
    (sqlite
      .prepare("SELECT count(*) c FROM drafts WHERE account_id IS NULL")
      .get() as { c: number }).c > 0 ||
    (targetsNeedsRebuild &&
      (sqlite.prepare("SELECT count(*) c FROM target_accounts").get() as {
        c: number;
      }).c > 0);

  const accountsCount = (
    sqlite.prepare("SELECT count(*) c FROM accounts").get() as { c: number }
  ).c;

  let mainId: number | null = null;
  if (accountsCount === 0 && hasOrphans) {
    const row = sqlite
      .prepare(
        "INSERT INTO accounts (handle, display_name, persona) VALUES ('main', 'Main', NULL) RETURNING id",
      )
      .get() as { id: number };
    mainId = row.id;
  }

  // Backfill orphan rows onto the Main account.
  if (mainId !== null) {
    sqlite
      .prepare("UPDATE voice_samples SET account_id = ? WHERE account_id IS NULL")
      .run(mainId);
    sqlite
      .prepare("UPDATE drafts SET account_id = ? WHERE account_id IS NULL")
      .run(mainId);
  }

  // Rebuild target_accounts to drop UNIQUE(handle) -> UNIQUE(account_id, handle).
  if (targetsNeedsRebuild) {
    const backfillId = mainId ?? "NULL";
    sqlite.exec(`
      ALTER TABLE target_accounts RENAME TO target_accounts_old;
      CREATE TABLE target_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        handle TEXT NOT NULL,
        notes TEXT,
        engagement_mode TEXT NOT NULL DEFAULT 'engage',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(account_id, handle)
      );
      INSERT INTO target_accounts (id, account_id, handle, notes, engagement_mode, created_at)
        SELECT id, ${backfillId}, handle, notes, engagement_mode, created_at FROM target_accounts_old;
      DROP TABLE target_accounts_old;
    `);
  }

  // Now that account_id exists on every data table, create its indexes.
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_drafts_account ON drafts(account_id);
    CREATE INDEX IF NOT EXISTS idx_voice_account ON voice_samples(account_id);
    CREATE INDEX IF NOT EXISTS idx_targets_account ON target_accounts(account_id);
  `);
}

export function getDb() {
  if (_db) return _db;
  migrateLegacyLocation();
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  _db = drizzle(sqlite);
  return _db;
}
