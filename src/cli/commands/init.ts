import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { parseArgs } from "util";
import { CONFIG } from "../../config";
import { getDb, getStats } from "../../db";
import { outputSuccess, outputError } from "../output";

export async function run(args: string[]): Promise<void> {
  const command = process.argv[2];

  if (command === "info") {
    await showInfo(args);
  } else {
    await initialize();
  }
}

async function initialize(): Promise<void> {
  try {
    if (!existsSync(CONFIG.dataDir)) {
      await mkdir(CONFIG.dataDir, { recursive: true });
    }

    // Initialize database (creates tables if needed)
    await getDb();

    outputSuccess(`Initialized krankie at ${CONFIG.dataDir}`);
    outputSuccess(`Database: ${CONFIG.dbPath}`);
  } catch (error) {
    if (error instanceof Error) {
      outputError(`Failed to initialize: ${error.message}`);
    }
    process.exit(1);
  }
}

async function showInfo(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const dbExists = existsSync(CONFIG.dbPath);
  let stats = null;

  if (dbExists) {
    try {
      stats = await getStats();
    } catch {
      // Database might be corrupted or inaccessible
    }
  }

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          dataDir: CONFIG.dataDir,
          dbPath: CONFIG.dbPath,
          logPath: CONFIG.logPath,
          dbExists,
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

Database exists: ${dbExists ? "yes" : "no"}
`);

    if (stats) {
      console.log(`Statistics:
  Apps: ${stats.appCount}
  Keywords: ${stats.keywordCount}
  Rankings: ${stats.rankingCount}
  Stores: ${stats.storeCount}
  Last check: ${stats.lastCheck ?? "never"}
`);
    }

    console.log(`Supported platforms: ${CONFIG.platforms.join(", ")}`);
  }
}
