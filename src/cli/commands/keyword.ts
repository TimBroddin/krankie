import { parseArgs } from "util";
import { addKeyword, listKeywords, deleteKeyword, getAppByAppId, getKeywordById } from "../../db";
import { outputTable, outputSuccess, outputError, outputWarning } from "../output";
import { isValidStore, isValidPlatform, type Platform } from "../../config";
import { checkRanking } from "../../scraper/appstore";
import { findKeywords, discoverKeywords } from "../../scraper/finder";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      await add(subArgs);
      break;
    case "list":
      await list(subArgs);
      break;
    case "delete":
      await remove(subArgs);
      break;
    case "find":
      await find(subArgs);
      break;
    case "discover":
      await discover(subArgs);
      break;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`Usage: krankie keyword <add|list|delete|find|discover> [options]

Commands:
  add <app_id> <keyword>  Add keyword to track
  list                    List all keywords
  delete <keyword_id>     Remove a keyword
  find <seed_keyword>     Find keyword opportunities via competitor analysis
  discover <app_id>       Discover keywords by analyzing an app's competitors

Add Options:
  --store <store>   Store code(s), comma-separated (default: us)
  --batch <kw,...>  Batch add multiple keywords (comma-separated)
  --json            Output as JSON

List Options:
  --app <app_id>    Filter by app
  --store <store>   Filter by store
  --platform <p>    Filter by platform (iphone, ipad, mac, etc.)
  --sort <field>    Sort by: rank, keyword, store, app, change, checked (default: rank)
  --desc            Reverse sort direction
  --json            Output as JSON

Find Options:
  --store <store>       Store code (default: us)
  --platform <p>        Platform (default: iphone)
  --limit <n>           Max keywords (default: 20)
  --depth <mode>        shallow or deep (default: shallow)
  --min-apps <n>        Min apps using keyword (default: 2)
  --top-apps <n>        Top apps to analyze (default: 10)
  --compare <app_id>    Compare against your app
  --json                Output as JSON

Discover Options:
  --store <store>       Store code (default: us)
  --platform <p>        Platform (default: iphone)
  --limit <n>           Max keywords (default: 20)
  --depth <mode>        shallow or deep (default: shallow)
  --min-apps <n>        Min apps using keyword (default: 2)
  --top-apps <n>        Competitor apps to analyze (default: 10)
  --json                Output as JSON
`);
}

async function add(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      store: { type: "string", default: "us" },
      batch: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];

  if (!appId) {
    outputError("App ID required");
    process.exit(1);
  }

  // Verify app exists
  const app = await getAppByAppId(appId);
  if (!app) {
    outputError(`App not found: ${appId}. Add it first with 'krankie app create ${appId}'`);
    process.exit(1);
  }

  // Parse stores
  const stores = (values.store as string).split(",").map((s) => s.trim().toLowerCase());

  // Validate stores
  for (const store of stores) {
    if (!isValidStore(store)) {
      outputWarning(`Unknown store code: "${store}" — proceeding anyway`);
    }
  }

  // Determine keywords: batch mode or single
  let keywords: string[];
  if (values.batch) {
    keywords = (values.batch as string).split(",").map((k) => k.trim()).filter(Boolean);
  } else {
    const keyword = positionals.slice(1).join(" ");
    if (!keyword) {
      outputError("Keyword required");
      process.exit(1);
    }
    keywords = [keyword];
  }

  // Validate keyword length
  for (const kw of keywords) {
    if (kw.length < 2) {
      outputWarning(`Keyword "${kw}" is very short (< 2 chars)`);
    }
    if (kw.length > 50) {
      outputWarning(`Keyword "${kw}" is very long (> 50 chars)`);
    }
  }

  const created: Awaited<ReturnType<typeof addKeyword>>[] = [];

  for (const keyword of keywords) {
    for (const store of stores) {
      try {
        const kw = await addKeyword(appId, keyword, store);
        created.push(kw);
      } catch (error) {
        if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
          outputError(`Keyword "${keyword}" already exists for ${appId} in ${store}`);
        } else {
          throw error;
        }
      }
    }
  }

  if (values.json) {
    console.log(JSON.stringify(created, null, 2));
  } else if (created.length > 0) {
    const kwNames = [...new Set(created.map((k) => k.keyword))];
    const storeNames = [...new Set(created.map((k) => k.store))];
    outputSuccess(
      `Added ${created.length} keyword${created.length > 1 ? "s" : ""}: ${kwNames.map((k) => `"${k}"`).join(", ")} in ${storeNames.join(", ")}`
    );

    // Quick rank check for single keyword + single store
    if (created.length <= 3) {
      console.log("");
      for (const kw of created) {
        try {
          process.stderr.write(`  Checking rank for "${kw.keyword}" (${kw.store})...`);
          const result = await checkRanking(appId, kw.keyword, kw.store, app.platform as Platform);
          process.stderr.write("\r" + " ".repeat(60) + "\r");
          if (result.rank) {
            console.log(`  "${kw.keyword}" (${kw.store}): rank #${result.rank}`);
          } else {
            console.log(`  "${kw.keyword}" (${kw.store}): not in top 200`);
          }
        } catch {
          // Silently skip if check fails
        }
      }
    }
  }
}

async function list(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      platform: { type: "string" },
      sort: { type: "string", default: "rank" },
      desc: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const keywords = await listKeywords({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
    platform: values.platform as string | undefined,
  });

  if (keywords.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log("No keywords tracked. Use 'krankie keyword add <app_id> <keyword> --store us' to add one.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(keywords, null, 2));
  } else {
    outputTable(
      ["ID", "Keyword", "Store", "App", "Platform"],
      keywords.map((k) => [k.id, k.keyword, k.store, k.app_name ?? k.app_store_id, k.platform])
    );
  }
}

async function remove(args: string[]): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const keywordId = positionals[0];
  if (!keywordId) {
    outputError("Keyword ID required");
    process.exit(1);
  }

  const id = parseInt(keywordId, 10);
  if (isNaN(id)) {
    outputError("Invalid keyword ID");
    process.exit(1);
  }

  // Get keyword info before deleting
  const keyword = await getKeywordById(id);
  const deleted = await deleteKeyword(id);

  if (deleted) {
    outputSuccess(`Deleted keyword: "${keyword?.keyword}" (${keyword?.store})`);
  } else {
    outputError(`Keyword not found: ${keywordId}`);
    process.exit(1);
  }
}

async function find(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      store: { type: "string", default: "us" },
      platform: { type: "string", default: "iphone" },
      limit: { type: "string", default: "20" },
      depth: { type: "string", default: "shallow" },
      "min-apps": { type: "string", default: "2" },
      "top-apps": { type: "string", default: "10" },
      compare: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const seed = positionals.join(" ");
  if (!seed) {
    outputError("Seed keyword required. Usage: krankie keyword find <keyword>");
    process.exit(1);
  }

  const store = values.store as string;
  const platform = values.platform as string;

  if (!isValidPlatform(platform)) {
    outputError(`Invalid platform: ${platform}. Valid: iphone, ipad, mac, appletv, watch`);
    process.exit(1);
  }

  const depth = values.depth as string;
  if (depth !== "shallow" && depth !== "deep") {
    outputError("Invalid depth. Use 'shallow' or 'deep'");
    process.exit(1);
  }

  const isJson = values.json as boolean;

  const result = await findKeywords({
    seed,
    store,
    platform: platform as Platform,
    limit: parseInt(values.limit as string, 10),
    depth: depth as "shallow" | "deep",
    minApps: parseInt(values["min-apps"] as string, 10),
    topApps: parseInt(values["top-apps"] as string, 10),
    compareAppId: values.compare as string | undefined,
    onProgress: isJson ? undefined : (msg) => process.stderr.write(`\r  ${msg}${"".padEnd(20)}`),
  });

  // Clear progress line
  if (!isJson) {
    process.stderr.write("\r" + " ".repeat(80) + "\r");
  }

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Header
  console.log(
    `\nKeyword Finder — seed: "${seed}" (${store.toUpperCase()} / ${platform})`
  );
  console.log(
    `Analyzed ${result.analyzedApps} competitor apps in ${result.elapsed} (${result.apiCalls} API calls)\n`
  );

  // Compare info
  if (values.compare) {
    if (result.compareRank) {
      console.log(`Your app ranks #${result.compareRank} for "${seed}"\n`);
    } else if (result.compareRank === null) {
      console.log(`Your app is not ranked for "${seed}"\n`);
    }
  }

  // Keywords table
  if (result.keywords.length === 0) {
    console.log("No keyword opportunities found. Try a different seed or lower --min-apps.\n");
  } else {
    const headers = ["#", "Keyword", "Apps", "Score", "Source"];
    if (depth === "deep") {
      headers.push("Comp.");
    }

    const rows = result.keywords.map((k, i) => {
      const row: (string | number)[] = [
        i + 1,
        k.keyword,
        `${k.frequency}/${result.analyzedApps}`,
        k.score,
        k.foundIn[0] ?? "-",
      ];
      if (depth === "deep") {
        row.push(k.competition ?? "-");
      }
      return row;
    });

    outputTable(headers, rows);
  }

  // Competitors
  if (result.competitors.length > 0) {
    console.log("\nTop competitors:");
    for (const comp of result.competitors.slice(0, 5)) {
      const rating = comp.rating ? ` (${comp.rating.toFixed(1)}★)` : "";
      console.log(`  #${comp.rank}  ${comp.name} — ${comp.developer}${rating}`);
    }
  }

  console.log(
    `\nTip: krankie keyword add <app_id> "${result.keywords[0]?.keyword ?? "..."}" --store ${store}`
  );
}

async function discover(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      store: { type: "string", default: "us" },
      platform: { type: "string", default: "iphone" },
      limit: { type: "string", default: "20" },
      depth: { type: "string", default: "shallow" },
      "min-apps": { type: "string", default: "2" },
      "top-apps": { type: "string", default: "10" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];
  if (!appId) {
    outputError("App ID required. Usage: krankie keyword discover <app_id>");
    process.exit(1);
  }

  const store = values.store as string;
  const platform = values.platform as string;

  if (!isValidPlatform(platform)) {
    outputError(`Invalid platform: ${platform}. Valid: iphone, ipad, mac, appletv, watch`);
    process.exit(1);
  }

  const depth = values.depth as string;
  if (depth !== "shallow" && depth !== "deep") {
    outputError("Invalid depth. Use 'shallow' or 'deep'");
    process.exit(1);
  }

  const isJson = values.json as boolean;

  const result = await discoverKeywords({
    appId,
    store,
    platform: platform as Platform,
    limit: parseInt(values.limit as string, 10),
    depth: depth as "shallow" | "deep",
    minApps: parseInt(values["min-apps"] as string, 10),
    topApps: parseInt(values["top-apps"] as string, 10),
    onProgress: isJson ? undefined : (msg) => process.stderr.write(`\r  ${msg}${"".padEnd(20)}`),
  });

  if (!isJson) {
    process.stderr.write("\r" + " ".repeat(80) + "\r");
  }

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Header
  console.log(`\nKeyword Discovery — ${result.seed} (${store.toUpperCase()} / ${platform})`);
  console.log(
    `Analyzed ${result.analyzedApps} competitor apps in ${result.elapsed} (${result.apiCalls} API calls)\n`
  );

  if (result.keywords.length === 0) {
    console.log("No keyword opportunities found. Try increasing --top-apps or lowering --min-apps.\n");
  } else {
    const headers = ["#", "Keyword", "Apps", "Score", "Source"];
    if (depth === "deep") {
      headers.push("Your Rank", "Comp.");
    }

    const rows = result.keywords.map((k, i) => {
      const row: (string | number)[] = [
        i + 1,
        k.keyword,
        `${k.frequency}/${result.analyzedApps}`,
        k.score,
        k.foundIn[0] ?? "-",
      ];
      if (depth === "deep") {
        row.push(k.avgRank ? `#${k.avgRank}` : "-");
        row.push(k.competition ?? "-");
      }
      return row;
    });

    outputTable(headers, rows);
  }

  if (result.competitors.length > 0) {
    console.log("\nTop competitors:");
    for (const comp of result.competitors.slice(0, 5)) {
      const rating = comp.rating ? ` (${comp.rating.toFixed(1)}★)` : "";
      console.log(`  #${comp.rank}  ${comp.name} — ${comp.developer}${rating}`);
    }
  }

  console.log(
    `\nTip: krankie keyword add ${appId} "${result.keywords[0]?.keyword ?? "..."}" --store ${store}`
  );
}
