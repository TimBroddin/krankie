import { Database } from "bun:sqlite";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";
import { CONFIG, type Platform } from "../config";

export const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL UNIQUE,
  name TEXT,
  developer TEXT,
  platform TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  store TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_id, keyword, store)
);

CREATE TABLE IF NOT EXISTS rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  rank INTEGER,
  checked_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_rankings_keyword_time ON rankings(keyword_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_app ON keywords(app_id);
`;

let _db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;

  const dir = dirname(CONFIG.dbPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  _db = new Database(CONFIG.dbPath);
  _db.exec("PRAGMA foreign_keys = ON");
  _db.exec(SCHEMA_SQL);

  // Set schema version if not set
  const version = _db.query("SELECT value FROM metadata WHERE key = 'schema_version'").get();
  if (!version) {
    _db.run("INSERT INTO metadata (key, value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION)]);
  }

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// Types
export interface App {
  id: number;
  app_id: string;
  name: string | null;
  developer: string | null;
  platform: Platform;
  created_at: string;
}

export interface Keyword {
  id: number;
  app_id: number;
  keyword: string;
  store: string;
  created_at: string;
}

export interface Ranking {
  id: number;
  keyword_id: number;
  rank: number | null;
  checked_at: string;
}

export interface KeywordWithApp extends Keyword {
  app_store_id: string;
  app_name: string | null;
  platform: Platform;
}
