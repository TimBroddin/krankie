import { parseArgs } from "util";

const INSTRUCTIONS_MD = `# krankie - App Store Keyword Ranking Tracker

## Quick Start
1. krankie init
2. krankie app create <app_id> --platform iphone
3. krankie keyword add <app_id> "my keyword" --store us
4. krankie check run
5. krankie rankings --json

## Commands

### App Management
- \`krankie app search <query>\` - Search App Store for apps
- \`krankie app create <app_id>\` - Add app to track
- \`krankie app list\` - List tracked apps
- \`krankie app show <app_id>\` - Show app details
- \`krankie app delete <app_id>\` - Remove app

### Keyword Management
- \`krankie keyword add <app_id> <keyword> --store <store>\` - Add keyword
- \`krankie keyword list\` - List all keywords
- \`krankie keyword delete <keyword_id>\` - Remove keyword

### Ranking Checks
- \`krankie check run\` - Fetch current rankings
- \`krankie check status\` - Show last check time

### Cron Scheduling
- \`krankie cron install\` - Install daily check
- \`krankie cron uninstall\` - Remove cron job
- \`krankie cron status\` - Show cron status

### Ranking Queries
- \`krankie rankings\` - Show current rankings
- \`krankie rankings movers\` - Show biggest changes
- \`krankie rankings history <keyword_id>\` - Show history

## Tips for Agents
- Use \`--json\` flag on all queries for parsing
- Rankings are 1-200, null means not in top 200
- Lower rank = better (1 is #1 position)
- check run respects rate limits, may take time
- Stores use ISO country codes: us, gb, de, fr, etc.
- Platforms: iphone, ipad, mac, appletv, watch
`;

const INSTRUCTIONS_JSON = {
  name: "krankie",
  description: "App Store Keyword Ranking Tracker",
  quickStart: [
    "krankie init",
    "krankie app create <app_id> --platform iphone",
    "krankie keyword add <app_id> <keyword> --store us",
    "krankie check run",
    "krankie rankings --json",
  ],
  commands: {
    app: {
      search: { args: "<query>", options: ["--platform", "--store", "--limit", "--json"] },
      create: { args: "<app_id>", options: ["--name", "--platform"] },
      list: { options: ["--json"] },
      show: { args: "<app_id>", options: ["--json"] },
      delete: { args: "<app_id>" },
    },
    keyword: {
      add: { args: "<app_id> <keyword>", options: ["--store"] },
      list: { options: ["--app", "--store", "--json"] },
      delete: { args: "<keyword_id>" },
    },
    check: {
      run: { options: ["--app", "--store"] },
      status: { options: ["--json"] },
    },
    cron: {
      install: { options: ["--hour"] },
      uninstall: {},
      status: {},
    },
    rankings: {
      default: { options: ["--app", "--keyword", "--store", "--days", "--json"] },
      movers: { options: ["--days", "--min-change", "--json"] },
      history: { args: "<keyword_id>", options: ["--days", "--json"] },
    },
  },
  tips: {
    jsonFlag: "Use --json for machine-readable output",
    rankingScale: "1-200, null if not found. Lower is better.",
    stores: "ISO country codes: us, gb, de, fr, etc.",
    platforms: ["iphone", "ipad", "mac", "appletv", "watch"],
  },
};

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      format: { type: "string", default: "markdown" },
    },
    allowPositionals: true,
  });

  const format = values.format as string;

  switch (format) {
    case "json":
      console.log(JSON.stringify(INSTRUCTIONS_JSON, null, 2));
      break;
    case "text":
      console.log(INSTRUCTIONS_MD.replace(/[#`*]/g, ""));
      break;
    case "markdown":
    default:
      console.log(INSTRUCTIONS_MD);
  }
}
