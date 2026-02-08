# Rating Tracking & Review Fetching

**Date:** 2026-02-08
**Status:** Design

## Overview

Add per-store rating tracking (aggregate + histogram) and review fetching/storage to krankie. Enables monitoring rating trends across markets and analyzing user reviews for own and competitor apps.

## Data Sources

All free, no authentication required:

- **Ratings + histogram**: `app-store-scraper` library (scrapes Apple's customer reviews page, returns `{ score, ratings, histogram: { 5: N, 4: N, 3: N, 2: N, 1: N } }`)
- **Reviews**: Same library's reviews endpoint (RSS feed, max ~500 per app/country)

## New Dependency

```
bun add app-store-scraper
```

## Database Changes (Schema v1 → v2)

### `ratings` table

```sql
CREATE TABLE ratings (
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
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ratings_app_store ON ratings(app_id, store, checked_at DESC);
```

One row inserted per app/store per check run. Builds time-series of rating changes.

### `reviews` table

```sql
CREATE TABLE reviews (
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
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(app_id, store, review_id)
);
CREATE INDEX idx_reviews_app_store ON reviews(app_id, store, updated_at DESC);
```

Deduplication via `UNIQUE(app_id, store, review_id)` — re-fetching same reviews is a no-op (INSERT OR IGNORE).

## New Files

### `src/scraper/ratings.ts`

- `fetchRatings(appId: string, store: string)` → `{ score, ratingsCount, histogram }`
  - Uses `app-store-scraper`'s `app()` with `ratings: true`
  - Reuses existing rate limiting from `ratelimit.ts`
- `fetchReviews(appId: string, store: string, options?)` → `Review[]`
  - Uses `app-store-scraper`'s `reviews()` endpoint
  - Options: `num` (default 100), `sort` (newest/rating/helpful)

### `src/cli/commands/ratings-cmd.ts`

- `krankie ratings` — show current ratings per app/store with previous comparison
- `krankie ratings history <app_id> [--store] [--days 30]` — rating trend over time

### `src/cli/commands/reviews.ts`

- `krankie reviews fetch [--app] [--store] [--num 100]` — fetch and store recent reviews
- `krankie reviews list [--app] [--store] [--score 1-2] [--days 7]` — browse stored reviews
- `krankie reviews summary [--app] [--store] [--days 7]` — sentiment summary (rating distribution, frequent words in negative reviews)

## Modified Files

### `src/db/index.ts`

- Schema migration v1 → v2: create `ratings` and `reviews` tables

### `src/db/queries.ts`

New queries:
- `addRating()`, `getLatestRatings()`, `getRatingHistory()`
- `addReview()`, `listReviews()`, `getReviewStats()`

### `src/cli/commands/check.ts`

- `check run` also fetches ratings for each unique app/store combo
- Deduplicates: if 10 keywords tracked for 1 app in "us", only 1 rating fetch
- Ratings follow same refresh interval as keywords (24h default)

### `src/tui/App.tsx` + new TUI views

- New "Ratings" view in TUI navigation
- New "Reviews" view for browsing stored reviews
- Overview gets ratings summary

## Integration Flow

```
check run
  ├── For each keyword: fetch ranking (existing)
  └── For each unique app/store: fetch ratings (new)
       └── INSERT INTO ratings (...)

reviews fetch
  └── For each app/store: fetch reviews from RSS
       └── INSERT OR IGNORE INTO reviews (...)
```

Reviews are fetched on-demand only (not in cron), to avoid excessive API calls.

## Implementation Order

1. Add `app-store-scraper` dependency
2. Schema migration (v1 → v2)
3. DB queries for ratings + reviews
4. Scraper functions (`src/scraper/ratings.ts`)
5. Integrate ratings into `check run`
6. `ratings` CLI command
7. `reviews` CLI commands (fetch, list, summary)
8. TUI views (Ratings, Reviews)
