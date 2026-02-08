import { parseArgs } from "util";
import { getCurrentRankings, getMovers, getRankingHistory, getKeywordById, type SortField } from "../../db";
import { outputTable, outputError } from "../output";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (subcommand === "movers") {
    await movers(args.slice(1));
    return;
  }

  if (subcommand === "history") {
    await history(args.slice(1));
    return;
  }

  // Default: show current rankings
  await current(args);
}

async function current(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      keyword: { type: "string" },
      store: { type: "string" },
      platform: { type: "string" },
      sort: { type: "string", default: "rank" },
      desc: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const validSorts: SortField[] = ["rank", "keyword", "store", "app", "change", "checked"];
  const sort = (validSorts.includes(values.sort as SortField) ? values.sort : "rank") as SortField;

  const rankings = await getCurrentRankings({
    appId: values.app as string | undefined,
    keyword: values.keyword as string | undefined,
    store: values.store as string | undefined,
    platform: values.platform as string | undefined,
    sort,
    desc: values.desc as boolean,
  });

  if (rankings.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log("No rankings yet. Run 'krankie check run' first.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(rankings, null, 2));
  } else {
    outputTable(
      ["Keyword", "Store", "App", "Rank", "Change"],
      rankings.map((r) => [
        r.keyword,
        r.store,
        r.app_name ?? r.app_store_id,
        r.current_rank ?? "-",
        formatChange(r.rank_change),
      ])
    );
  }
}

async function movers(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      days: { type: "string", default: "1" },
      "min-change": { type: "string", default: "1" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const days = parseInt(values.days as string, 10);
  const minChange = parseInt(values["min-change"] as string, 10);

  const moversData = await getMovers({ days, minChange });

  if (moversData.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log(`No significant rank changes in the last ${days} day(s).`);
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(moversData, null, 2));
  } else {
    console.log(`Top movers (last ${days} day${days > 1 ? "s" : ""}, min change: ${minChange}):\n`);

    outputTable(
      ["Change", "Keyword", "Store", "App", "From", "To"],
      moversData.map((r) => [
        formatChange(r.rank_change),
        r.keyword,
        r.store,
        r.app_name ?? r.app_store_id,
        r.previous_rank ?? "-",
        r.current_rank ?? "-",
      ])
    );
  }
}

async function history(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      days: { type: "string", default: "7" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const keywordId = positionals[0];
  if (!keywordId) {
    outputError("Keyword ID required. Use 'krankie keyword list' to see IDs.");
    process.exit(1);
  }

  const id = parseInt(keywordId, 10);
  if (isNaN(id)) {
    outputError("Invalid keyword ID");
    process.exit(1);
  }

  const keyword = await getKeywordById(id);
  if (!keyword) {
    outputError(`Keyword not found: ${keywordId}`);
    process.exit(1);
  }

  const days = parseInt(values.days as string, 10);
  const rankings = await getRankingHistory(id, days);

  if (rankings.length === 0) {
    if (values.json) {
      console.log(JSON.stringify({ keyword, history: [] }, null, 2));
    } else {
      console.log(`No ranking history for "${keyword.keyword}" (${keyword.store}) in the last ${days} days.`);
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify({ keyword, history: rankings }, null, 2));
  } else {
    console.log(`History for "${keyword.keyword}" (${keyword.store}) - ${keyword.app_name ?? keyword.app_store_id}\n`);

    outputTable(
      ["Date", "Rank"],
      rankings.map((r) => [
        new Date(r.checked_at).toLocaleString(),
        r.rank ?? "-",
      ])
    );
  }
}

function formatChange(change: number | null): string {
  if (change === null || change === 0) return "-";
  if (change > 0) return `▲ +${change}`;
  return `▼ ${change}`;
}
