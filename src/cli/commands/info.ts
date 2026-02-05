import { existsSync } from "fs";
import { parseArgs } from "util";
import { CONFIG } from "../../config";
import { getDb, getStats } from "../../db";

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  // Auto-initialize database if needed
  await getDb();

  const stats = await getStats();

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          dataDir: CONFIG.dataDir,
          dbPath: CONFIG.dbPath,
          logPath: CONFIG.logPath,
          platforms: CONFIG.platforms,
          stats,
        },
        null,
        2
      )
    );
  } else {
    console.log(`krankie info

Data directory: ${CONFIG.dataDir}
Database: ${CONFIG.dbPath}
Log file: ${CONFIG.logPath}

Statistics:
  Apps: ${stats.appCount}
  Keywords: ${stats.keywordCount}
  Rankings: ${stats.rankingCount}
  Stores: ${stats.storeCount}
  Last check: ${stats.lastCheck ?? "never"}

Supported platforms: ${CONFIG.platforms.join(", ")}`);
  }
}
