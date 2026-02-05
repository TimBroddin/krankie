import { parseArgs } from "util";
import { listKeywords, addRanking, setMetadata, getMetadata, getStats } from "../../db";
import { checkMultiple, type CheckProgress } from "../../scraper/appstore";
import { outputSuccess, outputError } from "../output";
import type { Platform } from "../../config";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "run":
      await runCheck(subArgs);
      break;
    case "status":
      await status(subArgs);
      break;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`Usage: krankie check <run|status> [options]

Commands:
  run      Run ranking check for all keywords
  status   Show last check time and status

Options:
  --app <app_id>    Filter by app
  --store <store>   Filter by store
  --json            Output as JSON
`);
}

async function runCheck(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const keywords = await listKeywords({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
  });

  if (keywords.length === 0) {
    if (values.json) {
      console.log(JSON.stringify({ checked: 0, message: "No keywords to check" }));
    } else {
      console.log("No keywords to check. Add keywords first with 'krankie keyword add'.");
    }
    return;
  }

  const checks = keywords.map((k) => ({
    appId: k.app_store_id,
    keyword: k.keyword,
    store: k.store,
    platform: k.platform as Platform,
    keywordId: k.id,
  }));

  if (!values.json) {
    console.log(`Checking ${checks.length} keyword(s)...\n`);
  }

  const onProgress = values.json
    ? undefined
    : (progress: CheckProgress) => {
        const pct = Math.round((progress.completed / progress.total) * 100);
        process.stdout.write(
          `\r[${pct.toString().padStart(3)}%] ${progress.current.keyword} (${progress.current.store})`.padEnd(60)
        );
      };

  const startTime = Date.now();
  const results = await checkMultiple(checks, onProgress);

  // Clear progress line
  if (!values.json) {
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }

  // Save rankings to database
  for (const result of results) {
    await addRanking(result.keywordId, result.rank);
  }

  // Update last check time
  await setMetadata("last_check", new Date().toISOString());

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const found = results.filter((r) => r.rank !== null).length;

  if (values.json) {
    console.log(
      JSON.stringify({
        checked: results.length,
        found,
        notFound: results.length - found,
        elapsed: `${elapsed}s`,
        results: results.map((r) => ({
          keyword: r.keyword,
          store: r.store,
          appId: r.appId,
          rank: r.rank,
        })),
      }, null, 2)
    );
  } else {
    outputSuccess(`Checked ${results.length} keywords in ${elapsed}s`);
    console.log(`  Found: ${found}`);
    console.log(`  Not ranked: ${results.length - found}`);

    // Show top movers summary
    const ranked = results.filter((r) => r.rank !== null && r.rank <= 50);
    if (ranked.length > 0) {
      console.log("\nTop 50 rankings:");
      ranked
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
        .slice(0, 10)
        .forEach((r) => {
          console.log(`  #${r.rank} "${r.keyword}" (${r.store})`);
        });
    }
  }
}

async function status(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const stats = await getStats();
  const lastCheck = stats.lastCheck;

  if (values.json) {
    console.log(
      JSON.stringify({
        lastCheck,
        lastCheckRelative: lastCheck ? getRelativeTime(new Date(lastCheck)) : null,
        ...stats,
      }, null, 2)
    );
  } else {
    console.log("Check status:");
    console.log(`  Last check: ${lastCheck ? `${lastCheck} (${getRelativeTime(new Date(lastCheck))})` : "never"}`);
    console.log(`  Apps: ${stats.appCount}`);
    console.log(`  Keywords: ${stats.keywordCount}`);
    console.log(`  Stores: ${stats.storeCount}`);
    console.log(`  Total rankings: ${stats.rankingCount}`);
  }
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
