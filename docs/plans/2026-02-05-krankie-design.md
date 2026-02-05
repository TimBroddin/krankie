# Krankie - AI-First App Store Keyword Ranking Tool

## Overview

Krankie is an agent-focused CLI tool for tracking keyword rankings on Apple App Stores. It provides full CLI control for agents and a read-only TUI dashboard for humans.

## Core Principles

- **Agent-first**: Every action available via CLI with `--json` output
- **Local-only**: SQLite database, no cloud dependencies
- **Full history**: Time-series ranking data for trend analysis
- **Self-documenting**: `krankie instructions` teaches agents how to use it

## Data Model

### Tables

```sql
CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL UNIQUE,  -- App Store ID (e.g., "6737412117")
  name TEXT,
  developer TEXT,
  platform TEXT NOT NULL,  -- iphone | ipad | mac | appletv | watch
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  store TEXT NOT NULL,  -- Country code: us, gb, de, etc.
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_id, keyword, store)
);

CREATE TABLE rankings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  rank INTEGER,  -- 1-200, NULL if not in top 200
  checked_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Indexes

```sql
CREATE INDEX idx_rankings_keyword_time ON rankings(keyword_id, checked_at DESC);
CREATE INDEX idx_keywords_app ON keywords(app_id);
```

## CLI Commands

### App Management

```
krankie app create <app_id> [--name <name>] [--platform <platform>]
krankie app list [--json]
krankie app show <app_id> [--json]
krankie app delete <app_id>
```

### Keyword Management

```
krankie keyword add <app_id> <keyword> --store <store>
krankie keyword add <app_id> <keyword> --store us,gb,de  # multiple stores
krankie keyword list [--app <app_id>] [--store <store>] [--json]
krankie keyword delete <keyword_id>
```

### Ranking Checks

```
krankie check run [--app <app_id>] [--store <store>]
krankie check status [--json]
```

### Cron Management

```
krankie cron install [--hour <0-23>]  # default: random 2-6 AM
krankie cron uninstall
krankie cron status
```

### Ranking Queries

```
krankie rankings [--app <app_id>] [--keyword <keyword>] [--store <store>] [--days <n>] [--json]
krankie rankings movers [--days <n>] [--min-change <n>] [--json]
krankie rankings history <keyword_id> [--days <n>] [--json]
```

### Utilities

```
krankie init
krankie info
krankie instructions [--format markdown|text|json]
krankie tui
```

## Scraping Strategy

### Endpoint

App Store search via iTunes API or direct App Store endpoints.

### Rate Limiting

- 2-5 second random delay between requests
- User-Agent rotation with realistic browser strings
- 3 retries with exponential backoff on failures
- Batch processing with delays between batches

### Rank Extraction

1. Build search URL: keyword + store + platform filter
2. Fetch and parse search results
3. Find target app position (1-200)
4. Store NULL if not found in top 200
5. Append to rankings table

## Cron Integration

- Installs via `crontab` manipulation
- Default: once daily at random hour (2-6 AM)
- Logs to `~/.krankie/check.log`
- Updates `metadata.last_check` on completion

## TUI Dashboard

### Views

1. **Overview** - Summary stats, top movers across all apps
2. **Apps** - List apps, drill into keywords per store
3. **Keywords** - Flat keyword list, sortable
4. **History** - Recent check log

### Navigation

- `←→` / `Tab`: Switch tabs
- `↑↓`: Navigate lists
- `Enter`: Drill into selection
- `Esc`: Go back
- `Tab` (in app detail): Cycle stores
- `r`: Refresh
- `q`: Quit

### Display

- Color coding: green (rank up), red (rank down)
- Auto-refresh every 30 seconds
- Shows 24h and 7d rank changes

## Project Structure

```
krankie/
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── app.ts
│   │   │   ├── keyword.ts
│   │   │   ├── check.ts
│   │   │   ├── cron.ts
│   │   │   ├── rankings.ts
│   │   │   ├── instructions.ts
│   │   │   └── init.ts
│   │   └── output.ts
│   │
│   ├── tui/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── views/
│   │   │   ├── Overview.tsx
│   │   │   ├── Apps.tsx
│   │   │   ├── AppDetail.tsx
│   │   │   ├── Keywords.tsx
│   │   │   └── History.tsx
│   │   └── components/
│   │       ├── Table.tsx
│   │       ├── Tabs.tsx
│   │       └── RankChange.tsx
│   │
│   ├── db/
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── queries.ts
│   │
│   ├── scraper/
│   │   ├── appstore.ts
│   │   ├── parser.ts
│   │   └── ratelimit.ts
│   │
│   └── config.ts
│
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Data Location

- Database: `~/.krankie/krankie.db`
- Logs: `~/.krankie/check.log`

## Platforms Supported

- iPhone (iphone)
- iPad (ipad)
- macOS (mac)
- Apple TV (appletv)
- Apple Watch (watch)
