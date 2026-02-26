import { getDb, type App, type Keyword, type Ranking, type KeywordWithApp, type AppRating, type Review, type CompetitorRanking, type AppCompetitor } from "./schema";
import type { Platform } from "../config";

// ============ Apps ============

export async function createApp(
  appId: string,
  platform: Platform,
  name?: string,
  developer?: string,
  options?: {
    isOwn?: boolean;
    trackKeywords?: boolean;
    trackRatings?: boolean;
    trackReviews?: boolean;
  }
): Promise<App> {
  const db = await getDb();
  const isOwn = options?.isOwn ? 1 : 0;
  // Own apps get all tracking by default unless explicitly set
  const trackKeywords = options?.trackKeywords !== undefined ? (options.trackKeywords ? 1 : 0) : isOwn;
  const trackRatings = options?.trackRatings !== undefined ? (options.trackRatings ? 1 : 0) : isOwn;
  const trackReviews = options?.trackReviews !== undefined ? (options.trackReviews ? 1 : 0) : isOwn;

  db.run(
    "INSERT INTO apps (app_id, name, developer, platform, is_own, track_keywords, track_ratings, track_reviews) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [appId, name ?? null, developer ?? null, platform, isOwn, trackKeywords, trackRatings, trackReviews]
  );
  return getAppByAppId(appId) as Promise<App>;
}

export async function updateApp(
  appId: string,
  updates: {
    name?: string;
    developer?: string;
    isOwn?: boolean;
    trackKeywords?: boolean;
    trackRatings?: boolean;
    trackReviews?: boolean;
  }
): Promise<App | null> {
  const db = await getDb();
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (updates.name !== undefined) { sets.push("name = ?"); params.push(updates.name); }
  if (updates.developer !== undefined) { sets.push("developer = ?"); params.push(updates.developer); }
  if (updates.isOwn !== undefined) { sets.push("is_own = ?"); params.push(updates.isOwn ? 1 : 0); }
  if (updates.trackKeywords !== undefined) { sets.push("track_keywords = ?"); params.push(updates.trackKeywords ? 1 : 0); }
  if (updates.trackRatings !== undefined) { sets.push("track_ratings = ?"); params.push(updates.trackRatings ? 1 : 0); }
  if (updates.trackReviews !== undefined) { sets.push("track_reviews = ?"); params.push(updates.trackReviews ? 1 : 0); }

  if (sets.length === 0) return getAppByAppId(appId);

  params.push(appId);
  db.run(`UPDATE apps SET ${sets.join(", ")} WHERE app_id = ?`, params);
  return getAppByAppId(appId);
}

export async function getAppByAppId(appId: string): Promise<App | null> {
  const db = await getDb();
  return db.query("SELECT * FROM apps WHERE app_id = ?").get(appId) as App | null;
}

export async function getAppById(id: number): Promise<App | null> {
  const db = await getDb();
  return db.query("SELECT * FROM apps WHERE id = ?").get(id) as App | null;
}

export async function listApps(options?: {
  isOwn?: boolean;
  platform?: string;
}): Promise<App[]> {
  const db = await getDb();
  let sql = "SELECT * FROM apps WHERE 1=1";
  const params: (string | number)[] = [];

  if (options?.isOwn !== undefined) {
    sql += " AND is_own = ?";
    params.push(options.isOwn ? 1 : 0);
  }

  if (options?.platform) {
    sql += " AND platform = ?";
    params.push(options.platform);
  }

  sql += " ORDER BY is_own DESC, created_at DESC";

  return db.query(sql).all(...params) as App[];
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
  platform?: string;
  isOwn?: boolean;
  trackKeywords?: boolean;
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

  if (options?.platform) {
    sql += " AND a.platform = ?";
    params.push(options.platform);
  }

  if (options?.isOwn !== undefined) {
    sql += " AND a.is_own = ?";
    params.push(options.isOwn ? 1 : 0);
  }

  if (options?.trackKeywords !== undefined) {
    sql += " AND a.track_keywords = ?";
    params.push(options.trackKeywords ? 1 : 0);
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

export type SortField = "rank" | "keyword" | "store" | "app" | "change" | "checked";

export async function getCurrentRankings(options?: {
  appId?: string;
  keyword?: string;
  store?: string;
  platform?: string;
  isOwn?: boolean;
  sort?: SortField;
  desc?: boolean;
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

  if (options?.platform) {
    sql += " AND a.platform = ?";
    params.push(options.platform);
  }

  if (options?.isOwn !== undefined) {
    sql += " AND a.is_own = ?";
    params.push(options.isOwn ? 1 : 0);
  }

  const sort = options?.sort ?? "rank";
  const dir = options?.desc ? "DESC" : "ASC";
  const nullDir = options?.desc ? "FIRST" : "LAST";

  switch (sort) {
    case "rank":
      sql += ` ORDER BY CASE WHEN l.current_rank IS NULL THEN 1 ELSE 0 END ${dir}, l.current_rank ${dir}`;
      break;
    case "keyword":
      sql += ` ORDER BY k.keyword ${dir}`;
      break;
    case "store":
      sql += ` ORDER BY k.store ${dir}, k.keyword ASC`;
      break;
    case "app":
      sql += ` ORDER BY COALESCE(a.name, a.app_id) ${dir}, k.keyword ASC`;
      break;
    case "change":
      sql += ` ORDER BY CASE WHEN (p.previous_rank - l.current_rank) IS NULL THEN 1 ELSE 0 END, ABS(COALESCE(p.previous_rank - l.current_rank, 0)) DESC`;
      break;
    case "checked":
      sql += ` ORDER BY l.checked_at ${options?.desc ? "ASC" : "DESC"}`;
      break;
    default:
      sql += " ORDER BY a.app_id, k.store, k.keyword";
  }

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

// ============ Ratings ============

export interface StaleRatingCheck {
  app_id: number;
  app_store_id: string;
  app_name: string | null;
  store: string;
  last_rating_at: string | null;
}

export async function getStaleRatingChecks(options?: {
  appId?: string;
  store?: string;
  force?: boolean;
  refreshIntervalHours?: number;
}): Promise<StaleRatingCheck[]> {
  const db = await getDb();
  const hours = options?.refreshIntervalHours ?? 24;

  let sql = `
    SELECT DISTINCT
      a.id as app_id,
      a.app_id as app_store_id,
      a.name as app_name,
      k.store,
      (SELECT MAX(r.checked_at) FROM ratings r WHERE r.app_id = a.id AND r.store = k.store) as last_rating_at
    FROM apps a
    JOIN keywords k ON k.app_id = a.id
    WHERE a.track_ratings = 1
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

  sql += " GROUP BY a.id, k.store";

  if (!options?.force) {
    sql += ` HAVING last_rating_at IS NULL OR last_rating_at < datetime('now', ?)`;
    params.push(`-${hours} hours`);
  }

  sql += " ORDER BY a.app_id, k.store";

  return db.query(sql).all(...params) as StaleRatingCheck[];
}

export async function addRating(
  appId: number,
  store: string,
  score: number | null,
  ratingsCount: number | null,
  histogram: Record<number, number> | null
): Promise<AppRating> {
  const db = await getDb();
  db.run(
    `INSERT INTO ratings (app_id, store, score, ratings_count, stars_1, stars_2, stars_3, stars_4, stars_5)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      appId,
      store,
      score,
      ratingsCount,
      histogram?.[1] ?? null,
      histogram?.[2] ?? null,
      histogram?.[3] ?? null,
      histogram?.[4] ?? null,
      histogram?.[5] ?? null,
    ]
  );

  return db
    .query("SELECT * FROM ratings WHERE app_id = ? AND store = ? ORDER BY checked_at DESC LIMIT 1")
    .get(appId, store) as AppRating;
}

export interface RatingWithApp extends AppRating {
  app_store_id: string;
  app_name: string | null;
  platform: string;
}

export interface RatingWithChange extends RatingWithApp {
  previous_score: number | null;
  score_change: number | null;
  previous_count: number | null;
  count_change: number | null;
}

export async function getLatestRatings(options?: {
  appId?: string;
  store?: string;
  platform?: string;
  isOwn?: boolean;
}): Promise<RatingWithChange[]> {
  const db = await getDb();

  let sql = `
    WITH latest AS (
      SELECT app_id, store, score, ratings_count, stars_1, stars_2, stars_3, stars_4, stars_5, checked_at,
             ROW_NUMBER() OVER (PARTITION BY app_id, store ORDER BY checked_at DESC) as rn
      FROM ratings
    ),
    previous AS (
      SELECT app_id, store, score as previous_score, ratings_count as previous_count,
             ROW_NUMBER() OVER (PARTITION BY app_id, store ORDER BY checked_at DESC) as rn
      FROM ratings
    )
    SELECT
      l.app_id, l.store, l.score, l.ratings_count, l.stars_1, l.stars_2, l.stars_3, l.stars_4, l.stars_5, l.checked_at,
      a.app_id as app_store_id, a.name as app_name, a.platform,
      p.previous_score,
      CASE WHEN l.score IS NOT NULL AND p.previous_score IS NOT NULL
        THEN ROUND(l.score - p.previous_score, 2) ELSE NULL END as score_change,
      p.previous_count,
      CASE WHEN l.ratings_count IS NOT NULL AND p.previous_count IS NOT NULL
        THEN l.ratings_count - p.previous_count ELSE NULL END as count_change
    FROM latest l
    JOIN apps a ON l.app_id = a.id
    LEFT JOIN previous p ON l.app_id = p.app_id AND l.store = p.store AND p.rn = 2
    WHERE l.rn = 1
  `;

  const params: string[] = [];

  if (options?.appId) {
    sql += " AND a.app_id = ?";
    params.push(options.appId);
  }

  if (options?.store) {
    sql += " AND l.store = ?";
    params.push(options.store);
  }

  if (options?.platform) {
    sql += " AND a.platform = ?";
    params.push(options.platform);
  }

  if (options?.isOwn !== undefined) {
    sql += " AND a.is_own = ?";
    params.push(options.isOwn ? 1 : 0);
  }

  sql += " ORDER BY a.app_id, l.store";

  return db.query(sql).all(...params) as RatingWithChange[];
}

export async function getRatingHistory(
  appId: string,
  store?: string,
  days: number = 30
): Promise<RatingWithApp[]> {
  const db = await getDb();

  let sql = `
    SELECT r.*, a.app_id as app_store_id, a.name as app_name, a.platform
    FROM ratings r
    JOIN apps a ON r.app_id = a.id
    WHERE a.app_id = ? AND r.checked_at >= datetime('now', ?)
  `;
  const params: (string | number)[] = [appId, `-${days} days`];

  if (store) {
    sql += " AND r.store = ?";
    params.push(store);
  }

  sql += " ORDER BY r.store, r.checked_at DESC";

  return db.query(sql).all(...params) as RatingWithApp[];
}

// ============ Reviews ============

export async function addReview(
  appId: number,
  store: string,
  reviewId: string,
  author: string | null,
  title: string | null,
  text: string | null,
  score: number,
  version: string | null,
  updatedAt: string | null
): Promise<boolean> {
  const db = await getDb();
  try {
    db.run(
      `INSERT OR IGNORE INTO reviews (app_id, store, review_id, author, title, text, score, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [appId, store, reviewId, author, title, text, score, version, updatedAt]
    );
    return true;
  } catch {
    return false;
  }
}

export async function addReviewsBatch(
  reviews: Array<{
    appId: number;
    store: string;
    reviewId: string;
    author: string | null;
    title: string | null;
    text: string | null;
    score: number;
    version: string | null;
    updatedAt: string | null;
  }>
): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO reviews (app_id, store, review_id, author, title, text, score, version, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let inserted = 0;
  for (const r of reviews) {
    const result = stmt.run(r.appId, r.store, r.reviewId, r.author, r.title, r.text, r.score, r.version, r.updatedAt);
    if (result.changes > 0) inserted++;
  }

  return inserted;
}

export interface ReviewWithApp extends Review {
  app_store_id: string;
  app_name: string | null;
  platform: string;
}

export async function listReviews(options?: {
  appId?: string;
  store?: string;
  platform?: string;
  isOwn?: boolean;
  minScore?: number;
  maxScore?: number;
  days?: number;
  limit?: number;
}): Promise<ReviewWithApp[]> {
  const db = await getDb();

  let sql = `
    SELECT rv.*, a.app_id as app_store_id, a.name as app_name, a.platform
    FROM reviews rv
    JOIN apps a ON rv.app_id = a.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (options?.appId) {
    sql += " AND a.app_id = ?";
    params.push(options.appId);
  }

  if (options?.store) {
    sql += " AND rv.store = ?";
    params.push(options.store);
  }

  if (options?.minScore != null) {
    sql += " AND rv.score >= ?";
    params.push(options.minScore);
  }

  if (options?.maxScore != null) {
    sql += " AND rv.score <= ?";
    params.push(options.maxScore);
  }

  if (options?.platform) {
    sql += " AND a.platform = ?";
    params.push(options.platform);
  }

  if (options?.isOwn !== undefined) {
    sql += " AND a.is_own = ?";
    params.push(options.isOwn ? 1 : 0);
  }

  if (options?.days) {
    sql += " AND rv.updated_at >= datetime('now', ?)";
    params.push(`-${options.days} days`);
  }

  sql += " ORDER BY rv.updated_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  return db.query(sql).all(...params) as ReviewWithApp[];
}

export interface ReviewStats {
  total: number;
  averageScore: number;
  distribution: Record<number, number>;
  recentCount: number;
  recentAverageScore: number;
}

export async function getReviewStats(options?: {
  appId?: string;
  store?: string;
  days?: number;
}): Promise<ReviewStats> {
  const db = await getDb();
  const days = options?.days ?? 30;

  let whereClause = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (options?.appId) {
    whereClause += " AND a.app_id = ?";
    params.push(options.appId);
  }

  if (options?.store) {
    whereClause += " AND rv.store = ?";
    params.push(options.store);
  }

  const totals = db.query(`
    SELECT COUNT(*) as total, AVG(rv.score) as avg_score
    FROM reviews rv
    JOIN apps a ON rv.app_id = a.id
    ${whereClause}
  `).get(...params) as { total: number; avg_score: number | null };

  const distRows = db.query(`
    SELECT rv.score, COUNT(*) as count
    FROM reviews rv
    JOIN apps a ON rv.app_id = a.id
    ${whereClause}
    GROUP BY rv.score
  `).all(...params) as Array<{ score: number; count: number }>;

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distRows) {
    distribution[row.score] = row.count;
  }

  const recentParams = [...params, `-${days} days`];
  const recent = db.query(`
    SELECT COUNT(*) as total, AVG(rv.score) as avg_score
    FROM reviews rv
    JOIN apps a ON rv.app_id = a.id
    ${whereClause} AND rv.updated_at >= datetime('now', ?)
  `).get(...recentParams) as { total: number; avg_score: number | null };

  return {
    total: totals.total,
    averageScore: totals.avg_score ?? 0,
    distribution,
    recentCount: recent.total,
    recentAverageScore: recent.avg_score ?? 0,
  };
}

// ============ Competitor Rankings ============

export async function addCompetitorRanking(
  appId: number,
  keyword: string,
  store: string,
  rank: number | null
): Promise<CompetitorRanking> {
  const db = await getDb();
  db.run(
    "INSERT INTO competitor_rankings (app_id, keyword, store, rank) VALUES (?, ?, ?, ?)",
    [appId, keyword, store, rank]
  );

  return db
    .query("SELECT * FROM competitor_rankings WHERE app_id = ? AND keyword = ? AND store = ? ORDER BY checked_at DESC LIMIT 1")
    .get(appId, keyword, store) as CompetitorRanking;
}

export async function addCompetitorRankingsBatch(
  rankings: Array<{
    appId: number;
    keyword: string;
    store: string;
    rank: number | null;
  }>
): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare(
    "INSERT INTO competitor_rankings (app_id, keyword, store, rank) VALUES (?, ?, ?, ?)"
  );

  let inserted = 0;
  for (const r of rankings) {
    stmt.run(r.appId, r.keyword, r.store, r.rank);
    inserted++;
  }

  return inserted;
}

export interface CompetitorRankingWithApp extends CompetitorRanking {
  app_store_id: string;
  app_name: string | null;
  platform: string;
  previous_rank: number | null;
  rank_change: number | null;
}

export async function getCompetitorRankings(options?: {
  appId?: string;
  keyword?: string;
  store?: string;
  days?: number;
}): Promise<CompetitorRankingWithApp[]> {
  const db = await getDb();

  let sql = `
    WITH latest AS (
      SELECT cr.app_id, cr.keyword, cr.store, cr.rank, cr.checked_at,
             ROW_NUMBER() OVER (PARTITION BY cr.app_id, cr.keyword, cr.store ORDER BY cr.checked_at DESC) as rn
      FROM competitor_rankings cr
    ),
    previous AS (
      SELECT cr.app_id, cr.keyword, cr.store, cr.rank as previous_rank,
             ROW_NUMBER() OVER (PARTITION BY cr.app_id, cr.keyword, cr.store ORDER BY cr.checked_at DESC) as rn
      FROM competitor_rankings cr
    )
    SELECT
      l.app_id, l.keyword, l.store, l.rank, l.checked_at,
      a.app_id as app_store_id, a.name as app_name, a.platform,
      p.previous_rank,
      CASE
        WHEN l.rank IS NULL OR p.previous_rank IS NULL THEN NULL
        ELSE p.previous_rank - l.rank
      END as rank_change
    FROM latest l
    JOIN apps a ON l.app_id = a.id
    LEFT JOIN previous p ON l.app_id = p.app_id AND l.keyword = p.keyword AND l.store = p.store AND p.rn = 2
    WHERE l.rn = 1
  `;

  const params: (string | number)[] = [];

  if (options?.appId) {
    sql += " AND a.app_id = ?";
    params.push(options.appId);
  }

  if (options?.keyword) {
    sql += " AND l.keyword LIKE ?";
    params.push(`%${options.keyword}%`);
  }

  if (options?.store) {
    sql += " AND l.store = ?";
    params.push(options.store);
  }

  if (options?.days) {
    sql += " AND l.checked_at >= datetime('now', ?)";
    params.push(`-${options.days} days`);
  }

  sql += " ORDER BY a.app_id, l.keyword, l.store";

  return db.query(sql).all(...params) as CompetitorRankingWithApp[];
}

// ============ App Competitors (linking) ============

export async function linkCompetitor(ownAppId: number, competitorAppId: number): Promise<void> {
  const db = await getDb();
  db.run(
    "INSERT OR IGNORE INTO app_competitors (own_app_id, competitor_app_id) VALUES (?, ?)",
    [ownAppId, competitorAppId]
  );
}

export async function unlinkCompetitor(ownAppId: number, competitorAppId: number): Promise<boolean> {
  const db = await getDb();
  const result = db.run(
    "DELETE FROM app_competitors WHERE own_app_id = ? AND competitor_app_id = ?",
    [ownAppId, competitorAppId]
  );
  return result.changes > 0;
}

export async function getLinkedCompetitors(ownAppId: number): Promise<App[]> {
  const db = await getDb();
  return db.query(
    `SELECT a.* FROM apps a
     JOIN app_competitors ac ON a.id = ac.competitor_app_id
     WHERE ac.own_app_id = ?
     ORDER BY a.name, a.app_id`
  ).all(ownAppId) as App[];
}

export async function getLinkedCompetitorIds(): Promise<number[]> {
  const db = await getDb();
  const rows = db.query(
    "SELECT DISTINCT competitor_app_id FROM app_competitors"
  ).all() as Array<{ competitor_app_id: number }>;
  return rows.map((r) => r.competitor_app_id);
}
