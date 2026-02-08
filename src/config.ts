import { homedir } from "os";
import { join } from "path";

export const CONFIG = {
  dataDir: join(homedir(), ".krankie"),
  dbPath: join(homedir(), ".krankie", "krankie.db"),
  logPath: join(homedir(), ".krankie", "check.log"),

  platforms: ["iphone", "ipad", "mac", "appletv", "watch"] as const,

  stores: [
    "us", "gb", "ca", "au", "de", "fr", "it", "es", "nl", "be",
    "at", "ch", "se", "no", "dk", "fi", "pt", "ie", "nz", "sg",
    "hk", "tw", "jp", "kr", "cn", "in", "br", "mx", "ar", "cl",
    "co", "pe", "za", "ae", "sa", "il", "tr", "pl", "cz", "hu",
    "ro", "bg", "hr", "sk", "si", "ee", "lv", "lt", "ua", "ru",
    "th", "my", "ph", "id", "vn", "ng", "ke", "eg", "pk", "kz",
  ] as const,

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

export type Store = (typeof CONFIG.stores)[number];

export function isValidStore(s: string): boolean {
  return CONFIG.stores.includes(s.toLowerCase() as Store);
}
