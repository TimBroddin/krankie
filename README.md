# krankie

AI-first App Store keyword ranking tracker. Built for agents, friendly for humans.

## Features

- **Agent-first CLI** - Every action available via CLI with `--json` output
- **Local SQLite database** - No cloud dependencies, full data ownership
- **Full ranking history** - Time-series data for trend analysis
- **Self-documenting** - `krankie instructions` teaches agents how to use it
- **TUI dashboard** - Fullscreen terminal UI for humans
- **Scheduled checks** - Cron integration for daily ranking updates

## Installation

```bash
# Using bun (recommended)
bunx krankie

# Or install globally
bun install -g krankie
```

## Quick Start

```bash
# Search for an app
krankie app search "my app" --platform iphone

# Add an app to track
krankie app create 6737412117 --platform iphone

# Add keywords to track (multiple stores supported)
krankie keyword add 6737412117 "keyword" --store us,gb,de

# Check rankings
krankie check run

# View results
krankie rankings
krankie rankings --json

# Launch TUI dashboard
krankie tui

# Schedule daily checks
krankie cron install --hour 3
```

## Commands

### App Management
- `krankie app search <query>` - Search App Store for apps
- `krankie app create <app_id>` - Add app to track (auto-fetches name)
- `krankie app list` - List tracked apps
- `krankie app show <app_id>` - Show tracked app details
- `krankie app info <app_id>` - Fetch full App Store metadata (ratings, version, description, etc.)
- `krankie app delete <app_id>` - Remove app

### Keyword Management
- `krankie keyword add <app_id> <keyword> --store <store>` - Add keyword
- `krankie keyword list` - List all keywords
- `krankie keyword delete <keyword_id>` - Remove keyword

### Ranking Checks
- `krankie check run` - Fetch current rankings
- `krankie check status` - Show last check time

### Cron Scheduling
- `krankie cron install [--hour <0-23>]` - Install daily check (random hour 2-6 AM if not specified)
- `krankie cron uninstall` - Remove cron job
- `krankie cron status` - Show cron status

Keywords are only re-checked once every 24 hours to avoid excessive API calls. Use `--force` with `check run` to override this.

### Ranking Queries
- `krankie rankings` - Show current rankings
- `krankie rankings movers` - Show biggest rank changes
- `krankie rankings history <keyword_id>` - Show history

### Utilities
- `krankie info` - Show database info and stats
- `krankie instructions` - Show agent instructions
- `krankie tui` - Launch fullscreen dashboard

## For Agents

```bash
# Get structured instructions
krankie instructions --format json

# All queries support --json
krankie app list --json
krankie keyword list --json
krankie rankings --json
krankie check status --json
```

### Claude Code Integration

**Install the App Store ASO skill:**

```bash
npx skills add timbroddin/app-store-aso-skill
```

This skill ([GitHub](https://github.com/TimBroddin/app-store-aso-skill)) teaches Claude how to analyze App Store listings, optimize metadata, and use krankie for keyword tracking.

**Or add to your CLAUDE.md:**

```markdown
## App Store Keyword Tracking

Use krankie for ASO keyword tracking. Run `bunx krankie instructions` for usage details.
```

**Or just prompt Claude:**

```
Track some common keywords for this app using krankie (bunx krankie instructions for details).
```

### Tips
- Rankings are 1-200, `null` means not in top 200
- Lower rank = better (1 is #1 position)
- Stores use ISO country codes: us, gb, de, fr, etc.
- Platforms: iphone, ipad, mac, appletv, watch

## Data Storage

All data is stored locally:
- Database: `~/.krankie/krankie.db`
- Logs: `~/.krankie/check.log`

## License

MIT
