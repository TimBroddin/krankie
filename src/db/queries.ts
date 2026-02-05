import { getDb, type App, type Keyword, type Ranking, type KeywordWithApp } from "./schema";
import type { Platform } from "../config";

// ============ Apps ============

export async function createApp(
  appId: string,
  platform: Platform,
  name?: string,
  developer?: string
): Promise<App> {
  const db = await getDb();
  db.run(
    "INSERT INTO apps (app_id, name, developer, platform) VALUES (?, ?, ?, ?)",
    [appId, name ?? null, developer ?? null, platform]
  );
  return getAppByAppId(appId) as Promise<App>;
}

export async function getAppByAppId(appId: string): Promise<App | null> {
  const db = await getDb();
  return db.query("SELECT * FROM apps WHERE app_id = ?").get(appId) as App | null;
}

export async function getAppById(id: number): Promise<App | null> {
  const db = await getDb();
  return db.query("SELECT * FROM apps WHERE id = ?").get(id) as App | null;
}

export async function listApps(): Promise<App[]> {
  const db = await getDb();
  return db.query("SELECT * FROM apps ORDER BY created_at DESC").all() as App[];
}

export async function deleteApp(appId: string): Promise<boolean> {
  const db = await getDb();
  const result = db.run("DELETE FROM apps WHERE app_id = ?", [appId]);
  return result.changes > 0;
}

// ============ Keywords ============

export async function addKeyword(
  appId: string,
  keyword: string,
  store: string
): Promise<Keyword> {
  const db = await getDb();
  const app = await getAppByAppId(appId);
  if (!app) {
    throw new Error(`App not found: ${appId}`);
  }

  db.run(
    "INSERT INTO keywords (app_id, keyword, store) VALUES (?, ?, ?)",
    [app.id, keyword, store]
  );

  const inserted = db
    .query("SELECT * FROM keywords WHERE app_id = ? AND keyword = ? AND store = ?")
    .get(app.id, keyword, store) as Keyword;

  return inserted;
}

export interface KeywordWithLastCheck extends KeywordWithApp {
  last_checked_at: string | null;
}

export async function listKeywords(options?: {
  appId?: string;
  store?: string;
  includeLastCheck?: boolean;
}): Promise<KeywordWithApp[]> {
  const db = await getDb();

  const selectLastCheck = options?.includeLastCheck
    ? ", (SELECT MAX(checked_at) FROM rankings WHERE keyword_id = k.id) as last_checked_at"
    : "";

  let sql = `
    SELECT k.*, a.app_id as app_store_id, a.name as app_name, a.platform${selectLastCheck}
    FROM keywords k
    JOIN apps a ON k.app_id = a.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (options?.appId) {
    sql += " AND a.app_id = ?";
    params.push(options.appId);
  }

  if (options?.store) {
    sql += " AND k.store = ?";
    params.push(options.store);
  }

  sql += " ORDER BY a.app_id, k.store, k.keyword";

  return db.query(sql).all(...params) as KeywordWithApp[];
}

export async function getKeywordById(id: number): Promise<KeywordWithApp | null> {
  const db = await getDb();
  return db
    .query(
      `SELECT k.*, a.app_id as app_store_id, a.name as app_name, a.platform
       FROM keywords k
       JOIN apps a ON k.app_id = a.id
       WHERE k.id = ?`
    )
    .get(id) as KeywordWithApp | null;
}

export async function deleteKeyword(id: number): Promise<boolean> {
  const db = await getDb();
  const result = db.run("DELETE FROM keywords WHERE id = ?", [id]);
  return result.changes > 0;
}

// ============ Rankings ============

export async function addRanking(
  keywordId: number,
  rank: number | null
): Promise<Ranking> {
  const db = await getDb();
  db.run("INSERT INTO rankings (keyword_id, rank) VALUES (?, ?)", [keywordId, rank]);

  return db
    .query("SELECT * FROM rankings WHERE keyword_id = ? ORDER BY checked_at DESC LIMIT 1")
    .get(keywordId) as Ranking;
}

export async function getLatestRanking(keywordId: number): Promise<Ranking | null> {
  const db = await getDb();
  return db
    .query("SELECT * FROM rankings WHERE keyword_id = ? ORDER BY checked_at DESC LIMIT 1")
    .get(keywordId) as Ranking | null;
}

export async function getRankingHistory(
  keywordId: number,
  days: number = 7
): Promise<Ranking[]> {
  const db = await getDb();
  return db
    .query(
      `SELECT * FROM rankings
       WHERE keyword_id = ? AND checked_at >= datetime('now', ?)
       ORDER BY checked_at DESC`
    )
    .all(keywordId, `-${days} days`) as Ranking[];
}

export interface RankingWithKeyword {
  keyword_id: number;
  keyword: string;
  store: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
  current_rank: number | null;
  previous_rank: number | null;
  rank_change: number | null;
  checked_at: string;
}

export async function getCurrentRankings(options?: {
  appId?: string;
  keyword?: string;
  store?: string;
}): Promise<RankingWithKeyword[]> {
  const db = await getDb();

  let sql = `
    WITH latest AS (
      SELECT keyword_id, rank as current_rank, checked_at,
             ROW_NUMBER() OVER (PARTITION BY keyword_id ORDER BY checked_at DESC) as rn
      FROM rankings
    ),
    previous AS (
      SELECT keyword_id, rank as previous_rank,
             ROW_NUMBER() OVER (PARTITION BY keyword_id ORDER BY checked_at DESC) as rn
      FROM rankings
    )
    SELECT
      k.id as keyword_id,
      k.keyword,
      k.store,
      a.app_id as app_store_id,
      a.name as app_name,
      a.platform,
      l.current_rank,
      p.previous_rank,
      CASE
        WHEN l.current_rank IS NULL OR p.previous_rank IS NULL THEN NULL
        ELSE p.previous_rank - l.current_rank
      END as rank_change,
      l.checked_at
    FROM keywords k
    JOIN apps a ON k.app_id = a.id
    LEFT JOIN latest l ON k.id = l.keyword_id AND l.rn = 1
    LEFT JOIN previous p ON k.id = p.keyword_id AND p.rn = 2
    WHERE 1=1
  `;

  const params: string[] = [];

  if (options?.appId) {
    sql += " AND a.app_id = ?";
    params.push(options.appId);
  }

  if (options?.keyword) {
    sql += " AND k.keyword LIKE ?";
    params.push(`%${options.keyword}%`);
  }

  if (options?.store) {
    sql += " AND k.store = ?";
    params.push(options.store);
  }

  sql += " ORDER BY a.app_id, k.store, k.keyword";

  return db.query(sql).all(...params) as RankingWithKeyword[];
}

export async function getMovers(options?: {
  days?: number;
  minChange?: number;
}): Promise<RankingWithKeyword[]> {
  const db = await getDb();
  const days = options?.days ?? 1;
  const minChange = options?.minChange ?? 1;

  const sql = `
    WITH recent AS (
      SELECT keyword_id, rank, checked_at,
             ROW_NUMBER() OVER (PARTITION BY keyword_id ORDER BY checked_at DESC) as rn
      FROM rankings
      WHERE checked_at >= datetime('now', ?)
    ),
    oldest AS (
      SELECT keyword_id, rank, checked_at,
             ROW_NUMBER() OVER (PARTITION BY keyword_id ORDER BY checked_at ASC) as rn
      FROM rankings
      WHERE checked_at >= datetime('now', ?)
    )
    SELECT
      k.id as keyword_id,
      k.keyword,
      k.store,
      a.app_id as app_store_id,
      a.name as app_name,
      a.platform,
      r.rank as current_rank,
      o.rank as previous_rank,
      CASE
        WHEN r.rank IS NULL OR o.rank IS NULL THEN NULL
        ELSE o.rank - r.rank
      END as rank_change,
      r.checked_at
    FROM keywords k
    JOIN apps a ON k.app_id = a.id
    JOIN recent r ON k.id = r.keyword_id AND r.rn = 1
    JOIN oldest o ON k.id = o.keyword_id AND o.rn = 1
    WHERE r.rank IS NOT NULL
      AND o.rank IS NOT NULL
      AND ABS(o.rank - r.rank) >= ?
    ORDER BY ABS(o.rank - r.rank) DESC
  `;

  return db.query(sql).all(`-${days} days`, `-${days} days`, minChange) as RankingWithKeyword[];
}

// ============ Metadata ============

export async function getMetadata(key: string): Promise<string | null> {
  const db = await getDb();
  const row = db.query("SELECT value FROM metadata WHERE key = ?").get(key) as { value: string } | null;
  return row?.value ?? null;
}

export async function setMetadata(key: string, value: string): Promise<void> {
  const db = await getDb();
  db.run(
    "INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
    [key, value, value]
  );
}

// ============ Stats ============

export interface DbStats {
  appCount: number;
  keywordCount: number;
  rankingCount: number;
  storeCount: number;
  lastCheck: string | null;
}

export async function getStats(): Promise<DbStats> {
  const db = await getDb();

  const appCount = (db.query("SELECT COUNT(*) as count FROM apps").get() as { count: number }).count;
  const keywordCount = (db.query("SELECT COUNT(*) as count FROM keywords").get() as { count: number }).count;
  const rankingCount = (db.query("SELECT COUNT(*) as count FROM rankings").get() as { count: number }).count;
  const storeCount = (db.query("SELECT COUNT(DISTINCT store) as count FROM keywords").get() as { count: number }).count;
  const lastCheck = await getMetadata("last_check");

  return { appCount, keywordCount, rankingCount, storeCount, lastCheck };
}
