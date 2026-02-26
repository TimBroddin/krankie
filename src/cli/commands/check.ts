import { parseArgs } from "util";
import { listKeywords, listApps, addRanking, addRating as addRatingDb, addCompetitorRankingsBatch, getLinkedCompetitorIds, setMetadata, getMetadata, getStats, getStaleRatingChecks, type KeywordWithLastCheck } from "../../db";
import { checkMultiple, type CheckProgress } from "../../scraper/appstore";
import { fetchMultipleRatings, type RatingCheckProgress } from "../../scraper/ratings";
import { outputSuccess, outputError } from "../output";
import { CONFIG, type Platform } from "../../config";

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
  --force           Check all keywords even if recently checked
  --json            Output as JSON
`);
}

async function runCheck(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      force: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const startTime = Date.now();
  let requestCount = 0;
  let keywordsChecked = 0;
  let keywordsSkipped = 0;
  let keywordsFound = 0;
  let ratingsChecked = 0;
  let ratingsSkipped = 0;
  let competitorRankingsStored = 0;
  const keywordResults: Array<{ keyword: string; store: string; appId: string; rank: number | null }> = [];

  // ── Keywords (only for apps with keyword tracking enabled) ──
  const keywords = await listKeywords({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
    trackKeywords: true,
    includeLastCheck: true,
  }) as KeywordWithLastCheck[];

  if (keywords.length > 0) {
    const refreshIntervalMs = CONFIG.scraper.refreshIntervalHours * 60 * 60 * 1000;
    const now = Date.now();

    const staleKeywords = values.force
      ? keywords
      : keywords.filter((k) => {
          if (!k.last_checked_at) return true;
          const lastCheck = new Date(k.last_checked_at).getTime();
          return now - lastCheck >= refreshIntervalMs;
        });

    keywordsSkipped = keywords.length - staleKeywords.length;

    // Fetch only linked competitor apps to track alongside keyword checks
    const linkedCompetitorDbIds = await getLinkedCompetitorIds();
    const allCompetitorApps = await listApps({ isOwn: false });
    const competitorApps = allCompetitorApps.filter((a) => linkedCompetitorDbIds.includes(a.id));
    const competitorAppIds = competitorApps.map((a) => a.app_id);
    // Build a map from app_id (store ID string) → DB id for batch insert
    const competitorIdMap = new Map(competitorApps.map((a) => [a.app_id, a.id]));

    if (staleKeywords.length > 0) {
      const checks = staleKeywords.map((k) => ({
        appId: k.app_store_id,
        keyword: k.keyword,
        store: k.store,
        platform: k.platform as Platform,
        keywordId: k.id,
      }));

      if (!values.json) {
        console.log(`Checking ${checks.length} keyword(s)...${competitorAppIds.length > 0 ? ` (tracking ${competitorAppIds.length} competitor(s))` : ""}\n`);
      }

      const onProgress = values.json
        ? undefined
        : (progress: CheckProgress) => {
            requestCount = progress.requests;
            const pct = Math.round((progress.completed / progress.total) * 100);
            process.stdout.write(
              `\r[${pct.toString().padStart(3)}%] ${progress.current.keyword} (${progress.current.store})`.padEnd(60)
            );
          };

      const { results, competitorResults } = await checkMultiple(checks, onProgress, competitorAppIds.length > 0 ? competitorAppIds : undefined);

      if (!values.json) {
        process.stdout.write("\r" + " ".repeat(60) + "\r");
      }

      for (const result of results) {
        await addRanking(result.keywordId, result.rank);
        keywordResults.push({ keyword: result.keyword, store: result.store, appId: result.appId, rank: result.rank });
      }

      // Store competitor rankings in batch
      if (competitorResults.length > 0) {
        const batchData = competitorResults
          .map((cr) => {
            const dbId = competitorIdMap.get(cr.appStoreId);
            if (!dbId) return null;
            return {
              appId: dbId,
              keyword: cr.keyword,
              store: cr.store,
              rank: cr.rank,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (batchData.length > 0) {
          competitorRankingsStored = await addCompetitorRankingsBatch(batchData);
        }
      }

      keywordsChecked = results.length;
      keywordsFound = results.filter((r) => r.rank !== null).length;
    } else if (!values.json) {
      console.log(`All ${keywordsSkipped} keywords checked within the last ${CONFIG.scraper.refreshIntervalHours}h.`);
    }
  }

  // ── Ratings ──
  const staleRatings = await getStaleRatingChecks({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
    force: values.force as boolean,
    refreshIntervalHours: CONFIG.scraper.refreshIntervalHours,
  });

  if (staleRatings.length > 0) {
    const ratingChecks = staleRatings.map((r) => ({
      appId: r.app_store_id,
      store: r.store,
      appName: r.app_name ?? r.app_store_id,
      dbAppId: r.app_id,
    }));

    if (!values.json) {
      console.log(`\nFetching ratings for ${ratingChecks.length} app/store combo(s)...\n`);
    }

    const onRatingProgress = values.json
      ? undefined
      : (progress: RatingCheckProgress) => {
          process.stdout.write(
            `\r[${Math.round((progress.completed / progress.total) * 100).toString().padStart(3)}%] ${progress.current.appName} (${progress.current.store})`.padEnd(60)
          );
        };

    const ratingResults = await fetchMultipleRatings(ratingChecks, onRatingProgress);

    if (!values.json) {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
    }

    for (const r of ratingResults) {
      if (r.score !== null || r.ratingsCount !== null) {
        await addRatingDb(r.dbAppId, r.store, r.score, r.ratingsCount, r.histogram);
        ratingsChecked++;
      }
    }
  }

  // ── Nothing to do? ──
  if (keywordsChecked === 0 && ratingsChecked === 0 && keywords.length > 0) {
    if (values.json) {
      console.log(JSON.stringify({
        checked: 0,
        skipped: keywordsSkipped,
        ratingsChecked: 0,
        ratingsSkipped: staleRatings.length === 0 ? keywords.length : 0,
        message: `Everything checked within the last ${CONFIG.scraper.refreshIntervalHours} hours. Use --force to check anyway.`,
      }));
    } else {
      console.log("Use --force to check anyway.");
    }
    return;
  }

  if (keywords.length === 0) {
    if (values.json) {
      console.log(JSON.stringify({ checked: 0, message: "No keywords to check" }));
    } else {
      console.log("No keywords to check. Add keywords first with 'krankie keyword add'.");
    }
    return;
  }

  // ── Summary ──
  await setMetadata("last_check", new Date().toISOString());

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (values.json) {
    console.log(
      JSON.stringify({
        checked: keywordsChecked,
        skipped: keywordsSkipped,
        requests: requestCount,
        found: keywordsFound,
        notFound: keywordsChecked - keywordsFound,
        ratingsChecked,
        competitorRankingsStored,
        elapsed: `${elapsed}s`,
        results: keywordResults,
      }, null, 2)
    );
  } else {
    if (keywordsChecked > 0) {
      outputSuccess(`Checked ${keywordsChecked} keywords (${requestCount} requests)`);
      if (keywordsSkipped > 0) {
        console.log(`  Skipped: ${keywordsSkipped} (checked within ${CONFIG.scraper.refreshIntervalHours}h)`);
      }
      console.log(`  Found: ${keywordsFound}`);
      console.log(`  Not ranked: ${keywordsChecked - keywordsFound}`);
    }
    if (competitorRankingsStored > 0) {
      outputSuccess(`Stored ${competitorRankingsStored} competitor ranking(s)`);
    }
    if (ratingsChecked > 0) {
      outputSuccess(`Fetched ratings for ${ratingsChecked} app/store combo(s)`);
    }
    console.log(`\nDone in ${elapsed}s`);

    // Show top movers summary
    const ranked = keywordResults.filter((r) => r.rank !== null && r.rank <= 50);
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
  const { lastCheck } = stats;

  if (values.json) {
    console.log(
      JSON.stringify({
        ...stats,
        lastCheckRelative: lastCheck ? getRelativeTime(new Date(lastCheck)) : null,
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
