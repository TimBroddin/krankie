import { homedir } from "os";
import { join } from "path";

export const CONFIG = {
  dataDir: join(homedir(), ".krankie"),
  dbPath: join(homedir(), ".krankie", "krankie.db"),
  logPath: join(homedir(), ".krankie", "check.log"),

  platforms: ["iphone", "ipad", "mac", "appletv", "watch"] as const,

  scraper: {
    minDelay: 2000,
    maxDelay: 5000,
    maxRetries: 3,
    maxRank: 200,
    refreshIntervalHours: 24,
  },

  cron: {
    defaultHourMin: 2,
    defaultHourMax: 6,
  },
} as const;

export type Platform = (typeof CONFIG.platforms)[number];

export function isValidPlatform(p: string): p is Platform {
  return CONFIG.platforms.includes(p as Platform);
}
