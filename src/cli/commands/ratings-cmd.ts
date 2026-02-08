import { parseArgs } from "util";
import { getLatestRatings, getRatingHistory, getAppByAppId } from "../../db";
import { outputTable, outputError } from "../output";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === "history") {
    await history(args.slice(1));
    return;
  }

  // Default: show current ratings
  await current(args);
}

async function current(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const ratings = await getLatestRatings({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
  });

  if (ratings.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log("No ratings data yet. Run 'krankie check run' to fetch ratings.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(ratings, null, 2));
  } else {
    outputTable(
      ["App", "Store", "Score", "Change", "Ratings", "New", "★5", "★4", "★3", "★2", "★1"],
      ratings.map((r) => [
        r.app_name ?? r.app_store_id,
        r.store,
        r.score?.toFixed(1) ?? "-",
        formatScoreChange(r.score_change),
        r.ratings_count?.toLocaleString() ?? "-",
        formatCountChange(r.count_change),
        r.stars_5 ?? "-",
        r.stars_4 ?? "-",
        r.stars_3 ?? "-",
        r.stars_2 ?? "-",
        r.stars_1 ?? "-",
      ])
    );
  }
}

async function history(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      store: { type: "string" },
      days: { type: "string", default: "30" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];
  if (!appId) {
    outputError("App ID required. Usage: krankie ratings history <app_id> [--store us] [--days 30]");
    process.exit(1);
  }

  const app = await getAppByAppId(appId);
  if (!app) {
    outputError(`App not found: ${appId}`);
    process.exit(1);
  }

  const days = parseInt(values.days as string, 10);
  const ratings = await getRatingHistory(
    appId,
    values.store as string | undefined,
    days
  );

  if (ratings.length === 0) {
    if (values.json) {
      console.log(JSON.stringify({ app, history: [] }, null, 2));
    } else {
      console.log(`No rating history for "${app.name ?? appId}" in the last ${days} days.`);
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify({ app, history: ratings }, null, 2));
  } else {
    console.log(`Rating history for "${app.name ?? appId}" (last ${days} days)\n`);

    outputTable(
      ["Date", "Store", "Score", "Ratings", "★5", "★4", "★3", "★2", "★1"],
      ratings.map((r) => [
        new Date(r.checked_at).toLocaleString(),
        r.store,
        r.score?.toFixed(1) ?? "-",
        r.ratings_count?.toLocaleString() ?? "-",
        r.stars_5 ?? "-",
        r.stars_4 ?? "-",
        r.stars_3 ?? "-",
        r.stars_2 ?? "-",
        r.stars_1 ?? "-",
      ])
    );
  }
}

function formatScoreChange(change: number | null): string {
  if (change === null || change === 0) return "-";
  if (change > 0) return `▲ +${change.toFixed(2)}`;
  return `▼ ${change.toFixed(2)}`;
}

function formatCountChange(change: number | null): string {
  if (change === null || change === 0) return "-";
  if (change > 0) return `+${change.toLocaleString()}`;
  return change.toLocaleString();
}
