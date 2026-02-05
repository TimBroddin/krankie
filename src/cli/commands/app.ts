import { parseArgs } from "util";
import { createApp, listApps, getAppByAppId, deleteApp, listKeywords } from "../../db";
import { lookupApp, lookupAppDetails, searchAppStore } from "../../scraper/appstore";
import { outputTable, outputSuccess, outputError } from "../output";
import { CONFIG, isValidPlatform, type Platform } from "../../config";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "create":
      await create(subArgs);
      break;
    case "list":
      await list(subArgs);
      break;
    case "show":
      await show(subArgs);
      break;
    case "info":
      await info(subArgs);
      break;
    case "delete":
      await remove(subArgs);
      break;
    case "search":
      await search(subArgs);
      break;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`Usage: krankie app <create|list|show|info|delete|search> [options]

Commands:
  create <app_id>   Add a new app to track
  list              List all tracked apps
  show <app_id>     Show tracked app details
  info <app_id>     Fetch full App Store metadata
  delete <app_id>   Remove an app
  search <query>    Search App Store for apps

Options:
  --name <name>         App name (auto-fetched if not provided)
  --platform <platform> Platform: ${CONFIG.platforms.join(", ")}
  --store <store>       Store/country code (default: us)
  --limit <n>           Max results for search (default: 10)
  --json                Output as JSON
`);
}

async function create(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      name: { type: "string" },
      platform: { type: "string", default: "iphone" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];
  if (!appId) {
    outputError("App ID required");
    process.exit(1);
  }

  const platform = values.platform as string;
  if (!isValidPlatform(platform)) {
    outputError(`Invalid platform: ${platform}. Must be one of: ${CONFIG.platforms.join(", ")}`);
    process.exit(1);
  }

  // Check if already exists
  const existing = await getAppByAppId(appId);
  if (existing) {
    outputError(`App ${appId} already exists`);
    process.exit(1);
  }

  // Auto-fetch name if not provided
  let name = values.name as string | undefined;
  let developer: string | undefined;

  if (!name) {
    const info = await lookupApp(appId);
    if (info) {
      name = info.trackName;
      developer = info.artistName;
    }
  }

  const app = await createApp(appId, platform as Platform, name, developer);

  if (values.json) {
    console.log(JSON.stringify(app, null, 2));
  } else {
    outputSuccess(`Added app: ${app.name ?? app.app_id} (${app.platform})`);
  }
}

async function list(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const apps = await listApps();

  if (apps.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log("No apps tracked. Use 'krankie app create <app_id>' to add one.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(apps, null, 2));
  } else {
    // Get keyword counts
    const keywords = await listKeywords();
    const keywordCounts = new Map<string, number>();
    keywords.forEach((k) => {
      const count = keywordCounts.get(k.app_store_id) ?? 0;
      keywordCounts.set(k.app_store_id, count + 1);
    });

    outputTable(
      ["App ID", "Name", "Platform", "Keywords"],
      apps.map((a) => [a.app_id, a.name ?? "-", a.platform, keywordCounts.get(a.app_id) ?? 0])
    );
  }
}

async function show(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];
  if (!appId) {
    outputError("App ID required");
    process.exit(1);
  }

  const app = await getAppByAppId(appId);
  if (!app) {
    outputError(`App not found: ${appId}`);
    process.exit(1);
  }

  const keywords = await listKeywords({ appId });

  if (values.json) {
    console.log(JSON.stringify({ ...app, keywords }, null, 2));
  } else {
    console.log(`App: ${app.name ?? app.app_id}`);
    console.log(`  ID: ${app.app_id}`);
    console.log(`  Platform: ${app.platform}`);
    console.log(`  Developer: ${app.developer ?? "-"}`);
    console.log(`  Created: ${app.created_at}`);
    console.log(`  Keywords: ${keywords.length}`);

    if (keywords.length > 0) {
      console.log("\nKeywords by store:");
      const byStore = new Map<string, string[]>();
      keywords.forEach((k) => {
        const list = byStore.get(k.store) ?? [];
        list.push(k.keyword);
        byStore.set(k.store, list);
      });

      byStore.forEach((kws, store) => {
        console.log(`  ${store}: ${kws.join(", ")}`);
      });
    }
  }
}

async function info(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      store: { type: "string", default: "us" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];
  if (!appId) {
    outputError("App ID required");
    process.exit(1);
  }

  const store = values.store as string;
  const details = await lookupAppDetails(appId, store);

  if (!details) {
    outputError(`App not found: ${appId}`);
    process.exit(1);
  }

  if (values.json) {
    console.log(JSON.stringify(details, null, 2));
  } else {
    const sizeInMB = (parseInt(details.fileSizeBytes, 10) / 1024 / 1024).toFixed(1);
    const rating = details.userRatingCount > 0
      ? `${details.averageUserRating.toFixed(1)} ⭐ (${details.userRatingCount.toLocaleString()})`
      : "No ratings yet";

    console.log(`\n${details.trackName}\n`);

    outputTable(
      ["Field", "Value"],
      [
        ["App ID", String(details.trackId)],
        ["Bundle ID", details.bundleId],
        ["Developer", details.artistName],
        ["Price", details.formattedPrice],
        ["Category", details.primaryGenreName],
        ["Genres", details.genres.join(", ")],
        ["Rating", rating],
        ["Version", details.version],
        ["Size", `${sizeInMB} MB`],
        ["Min iOS", details.minimumOsVersion],
        ["Content Rating", details.contentAdvisoryRating],
        ["Released", new Date(details.releaseDate).toLocaleDateString()],
        ["Updated", new Date(details.currentVersionReleaseDate).toLocaleDateString()],
        ["Languages", details.languageCodesISO2A.slice(0, 8).join(", ") + (details.languageCodesISO2A.length > 8 ? ` (+${details.languageCodesISO2A.length - 8})` : "")],
        ["App Store", details.trackViewUrl],
      ]
    );

    if (details.releaseNotes) {
      console.log(`\nRelease Notes:\n${details.releaseNotes.slice(0, 400)}${details.releaseNotes.length > 400 ? "..." : ""}`);
    }

    console.log(`\nDescription:\n${details.description.slice(0, 400)}${details.description.length > 400 ? "..." : ""}\n`);
  }
}

async function remove(args: string[]): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const appId = positionals[0];
  if (!appId) {
    outputError("App ID required");
    process.exit(1);
  }

  const deleted = await deleteApp(appId);
  if (deleted) {
    outputSuccess(`Deleted app: ${appId}`);
  } else {
    outputError(`App not found: ${appId}`);
    process.exit(1);
  }
}

async function search(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      platform: { type: "string", default: "iphone" },
      store: { type: "string", default: "us" },
      limit: { type: "string", default: "10" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const query = positionals.join(" ");
  if (!query) {
    outputError("Search query required");
    process.exit(1);
  }

  const platform = values.platform as string;
  if (!isValidPlatform(platform)) {
    outputError(`Invalid platform: ${platform}. Must be one of: ${CONFIG.platforms.join(", ")}`);
    process.exit(1);
  }

  const limit = parseInt(values.limit as string, 10);
  const store = values.store as string;

  const results = await searchAppStore(query, store, platform as Platform, limit);

  if (results.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log(`No apps found for "${query}" in ${store} (${platform})`);
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`Results for "${query}" in ${store} (${platform}):\n`);
    outputTable(
      ["App ID", "Name", "Developer"],
      results.map((r) => [r.trackId, r.trackName, r.artistName])
    );
    console.log(`\nTo track an app: krankie app create <app_id> --platform ${platform}`);
  }
}
