import { CONFIG, type Platform } from "../config";
import { randomDelay, sleep, withRetry, randomUserAgent } from "./ratelimit";
import { parseSearchResults, platformToEntity, type ITunesSearchResponse } from "./parser";

export interface RankResult {
  keyword: string;
  store: string;
  appId: string;
  rank: number | null;
  checkedAt: Date;
}

export async function searchKeyword(
  keyword: string,
  store: string,
  platform: Platform
): Promise<ITunesSearchResponse> {
  const entity = platformToEntity(platform);

  // iTunes Search API
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", keyword);
  url.searchParams.set("country", store);
  url.searchParams.set("entity", entity);
  url.searchParams.set("limit", String(CONFIG.scraper.maxRank));

  const response = await withRetry(async () => {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": randomUserAgent(),
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<ITunesSearchResponse>;
  });

  return response;
}

export async function checkRanking(
  appId: string,
  keyword: string,
  store: string,
  platform: Platform
): Promise<RankResult> {
  const response = await searchKeyword(keyword, store, platform);
  const { rank } = parseSearchResults(response, appId);

  return {
    keyword,
    store,
    appId,
    rank,
    checkedAt: new Date(),
  };
}

export interface CheckProgress {
  total: number;
  completed: number;
  requests: number;
  current: {
    keyword: string;
    store: string;
  };
}

export type ProgressCallback = (progress: CheckProgress) => void;

interface CheckInput {
  appId: string;
  keyword: string;
  store: string;
  platform: Platform;
  keywordId: number;
}

export async function checkMultiple(
  checks: CheckInput[],
  onProgress?: ProgressCallback
): Promise<Array<RankResult & { keywordId: number }>> {
  const results: Array<RankResult & { keywordId: number }> = [];

  // Group checks by (keyword, store, platform) to dedupe API requests
  // Multiple apps can share the same keyword search
  const groupedChecks = new Map<string, CheckInput[]>();

  for (const check of checks) {
    const key = `${check.keyword}|${check.store}|${check.platform}`;
    const group = groupedChecks.get(key);
    if (group) {
      group.push(check);
    } else {
      groupedChecks.set(key, [check]);
    }
  }

  const groups = Array.from(groupedChecks.values());
  let completedChecks = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]!;
    const first = group[0]!;

    if (onProgress) {
      onProgress({
        total: checks.length,
        completed: completedChecks,
        requests: groups.length,
        current: {
          keyword: first.keyword,
          store: first.store,
        },
      });
    }

    // Single API request for this keyword/store/platform
    const response = await searchKeyword(first.keyword, first.store, first.platform);
    const checkedAt = new Date();

    // Extract ranks for ALL apps in this group from the single response
    for (const check of group) {
      const { rank } = parseSearchResults(response, check.appId);
      results.push({
        keyword: check.keyword,
        store: check.store,
        appId: check.appId,
        rank,
        checkedAt,
        keywordId: check.keywordId,
      });
      completedChecks++;
    }

    // Add delay between requests (except for the last one)
    if (i < groups.length - 1) {
      await sleep(randomDelay());
    }
  }

  return results;
}

// Utility to get app info from App Store
export async function lookupApp(
  appId: string,
  store: string = "us"
): Promise<{
  trackId: number;
  trackName: string;
  artistName: string;
  bundleId: string;
} | null> {
  const url = `https://itunes.apple.com/lookup?id=${appId}&country=${store}`;

  try {
    const response = await withRetry(async () => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": randomUserAgent(),
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return res.json() as Promise<ITunesSearchResponse>;
    });

    if (response.resultCount > 0 && response.results[0]) {
      const app = response.results[0];
      return {
        trackId: app.trackId,
        trackName: app.trackName,
        artistName: app.artistName,
        bundleId: app.bundleId,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Search App Store for apps
export interface AppSearchResult {
  trackId: number;
  trackName: string;
  artistName: string;
  bundleId: string;
  artworkUrl60?: string;
  price?: number;
  averageUserRating?: number;
}

export async function searchAppStore(
  query: string,
  store: string,
  platform: Platform,
  limit: number = 10
): Promise<AppSearchResult[]> {
  const entity = platformToEntity(platform);

  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("country", store);
  url.searchParams.set("entity", entity);
  url.searchParams.set("limit", String(limit));

  const response = await withRetry(async () => {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": randomUserAgent(),
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<ITunesSearchResponse>;
  });

  return response.results.map((r) => ({
    trackId: r.trackId,
    trackName: r.trackName,
    artistName: r.artistName,
    bundleId: r.bundleId,
    artworkUrl60: (r as Record<string, unknown>).artworkUrl60 as string | undefined,
    price: (r as Record<string, unknown>).price as number | undefined,
    averageUserRating: (r as Record<string, unknown>).averageUserRating as number | undefined,
  }));
}
