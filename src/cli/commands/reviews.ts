import { parseArgs } from "util";
import { getAppByAppId, listApps, addReviewsBatch, listReviews, getReviewStats } from "../../db";
import { fetchReviews } from "../../scraper/ratings";
import { outputTable, outputSuccess, outputError } from "../output";
import { sleep, randomDelay } from "../../scraper/ratelimit";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case "fetch":
      await fetchCmd(args.slice(1));
      break;
    case "list":
      await listCmd(args.slice(1));
      break;
    case "summary":
      await summaryCmd(args.slice(1));
      break;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`Usage: krankie reviews <fetch|list|summary> [options]

Commands:
  fetch     Fetch reviews from App Store
  list      Browse stored reviews
  summary   Show review statistics

Options:
  --app <app_id>     Filter by app
  --store <store>    Filter by store
  --num <count>      Number of reviews to fetch (default: 100)
  --score <range>    Filter by score (e.g. "1-2" for negative)
  --days <days>      Filter by recency
  --json             Output as JSON
`);
}

async function fetchCmd(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      num: { type: "string", default: "100" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const num = parseInt(values.num as string, 10);
  const apps = values.app
    ? [await getAppByAppId(values.app as string)].filter(Boolean)
    : await listApps();

  if (apps.length === 0) {
    outputError("No apps found. Add apps first with 'krankie app create'.");
    return;
  }

  // Collect unique app/store combinations
  const targets: Array<{ app: NonNullable<typeof apps[0]>; store: string }> = [];

  for (const app of apps) {
    if (!app) continue;
    if (values.store) {
      targets.push({ app, store: values.store as string });
    } else {
      // Default to 'us' if no store specified
      targets.push({ app, store: "us" });
    }
  }

  let totalNew = 0;
  let totalFetched = 0;

  for (let i = 0; i < targets.length; i++) {
    const { app, store } = targets[i]!;

    if (!values.json) {
      process.stdout.write(
        `\rFetching reviews for ${app.name ?? app.app_id} (${store})...`.padEnd(60)
      );
    }

    try {
      const reviews = await fetchReviews(app.app_id, store, { num });
      totalFetched += reviews.length;

      const inserted = await addReviewsBatch(
        reviews.map((r) => ({
          appId: app.id,
          store,
          reviewId: r.id,
          author: r.author,
          title: r.title,
          text: r.text,
          score: r.score,
          version: r.version,
          updatedAt: r.updated,
        }))
      );

      totalNew += inserted;
    } catch (error) {
      if (!values.json) {
        process.stdout.write("\r" + " ".repeat(60) + "\r");
        outputError(`Failed to fetch reviews for ${app.name ?? app.app_id} (${store}): ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    // Rate limit between apps
    if (i < targets.length - 1) {
      await sleep(randomDelay());
    }
  }

  if (!values.json) {
    process.stdout.write("\r" + " ".repeat(60) + "\r");
  }

  if (values.json) {
    console.log(JSON.stringify({
      fetched: totalFetched,
      new: totalNew,
      existing: totalFetched - totalNew,
    }, null, 2));
  } else {
    outputSuccess(`Fetched ${totalFetched} reviews, ${totalNew} new`);
    if (totalFetched - totalNew > 0) {
      console.log(`  Already stored: ${totalFetched - totalNew}`);
    }
  }
}

async function listCmd(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      score: { type: "string" },
      days: { type: "string" },
      limit: { type: "string", default: "20" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  let minScore: number | undefined;
  let maxScore: number | undefined;

  if (values.score) {
    const scoreStr = values.score as string;
    if (scoreStr.includes("-")) {
      const [min, max] = scoreStr.split("-").map(Number);
      minScore = min;
      maxScore = max;
    } else {
      minScore = parseInt(scoreStr, 10);
      maxScore = minScore;
    }
  }

  const reviews = await listReviews({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
    minScore,
    maxScore,
    days: values.days ? parseInt(values.days as string, 10) : undefined,
    limit: parseInt(values.limit as string, 10),
  });

  if (reviews.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log("No reviews found. Run 'krankie reviews fetch' to fetch reviews.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(reviews, null, 2));
  } else {
    outputTable(
      ["Score", "App", "Store", "Title", "Author", "Version", "Date"],
      reviews.map((r) => [
        "★".repeat(r.score) + "☆".repeat(5 - r.score),
        r.app_name ?? r.app_store_id,
        r.store,
        (r.title ?? "").slice(0, 40),
        (r.author ?? "").slice(0, 15),
        r.version ?? "-",
        r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "-",
      ])
    );

    if (reviews.length >= parseInt(values.limit as string, 10)) {
      console.log(`\nShowing ${reviews.length} reviews. Use --limit to see more.`);
    }
  }
}

async function summaryCmd(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      days: { type: "string", default: "30" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const days = parseInt(values.days as string, 10);
  const stats = await getReviewStats({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
    days,
  });

  if (stats.total === 0) {
    if (values.json) {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log("No reviews stored yet. Run 'krankie reviews fetch' first.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log("Review Summary\n");
    console.log(`  Total reviews:    ${stats.total}`);
    console.log(`  Average score:    ${stats.averageScore.toFixed(2)}`);
    console.log(`  Distribution:`);

    const maxCount = Math.max(...Object.values(stats.distribution));
    for (let star = 5; star >= 1; star--) {
      const count = stats.distribution[star] ?? 0;
      const barLen = maxCount > 0 ? Math.round((count / maxCount) * 30) : 0;
      const bar = "█".repeat(barLen);
      const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : "0.0";
      console.log(`    ${star}★  ${bar.padEnd(30)} ${count} (${pct}%)`);
    }

    console.log(`\n  Last ${days} days:`);
    console.log(`    Reviews:        ${stats.recentCount}`);
    console.log(`    Average score:  ${stats.recentAverageScore.toFixed(2)}`);

    // Sentiment breakdown
    const positive = (stats.distribution[4] ?? 0) + (stats.distribution[5] ?? 0);
    const neutral = stats.distribution[3] ?? 0;
    const negative = (stats.distribution[1] ?? 0) + (stats.distribution[2] ?? 0);
    const total = positive + neutral + negative;

    if (total > 0) {
      console.log(`\n  Sentiment:`);
      console.log(`    Positive (4-5★): ${positive} (${((positive / total) * 100).toFixed(1)}%)`);
      console.log(`    Neutral  (3★):   ${neutral} (${((neutral / total) * 100).toFixed(1)}%)`);
      console.log(`    Negative (1-2★): ${negative} (${((negative / total) * 100).toFixed(1)}%)`);
    }
  }
}
