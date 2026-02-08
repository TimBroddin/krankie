import { getDb, SCHEMA_VERSION } from "./schema";

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  const row = db.query("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | null;
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  if (currentVersion === 0) {
    // Fresh install, schema already created by getDb()
    return;
  }

  if (currentVersion < 2) {
    // Add ratings and reviews tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        store TEXT NOT NULL,
        score REAL,
        ratings_count INTEGER,
        stars_1 INTEGER,
        stars_2 INTEGER,
        stars_3 INTEGER,
        stars_4 INTEGER,
        stars_5 INTEGER,
        checked_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        store TEXT NOT NULL,
        review_id TEXT NOT NULL,
        author TEXT,
        title TEXT,
        text TEXT,
        score INTEGER NOT NULL,
        version TEXT,
        updated_at TEXT,
        fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(app_id, store, review_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ratings_app_store ON ratings(app_id, store, checked_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reviews_app_store ON reviews(app_id, store, updated_at DESC);
    `);
    db.run("UPDATE metadata SET value = '2' WHERE key = 'schema_version'");
  }

  if (currentVersion < 3) {
    // Add own/competitor distinction and tracking toggles to apps
    db.exec(`
      ALTER TABLE apps ADD COLUMN is_own INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE apps ADD COLUMN track_keywords INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE apps ADD COLUMN track_ratings INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE apps ADD COLUMN track_reviews INTEGER NOT NULL DEFAULT 0;
    `);

    // Existing apps with keywords are assumed to be "own" apps with all tracking on
    db.exec(`
      UPDATE apps SET is_own = 1, track_keywords = 1, track_ratings = 1, track_reviews = 1
      WHERE id IN (SELECT DISTINCT app_id FROM keywords);
    `);

    db.run("UPDATE metadata SET value = '3' WHERE key = 'schema_version'");
  }
}

export { getDb, closeDb } from "./schema";
