import { CONFIG, type Platform } from "../config";
import { randomDelay, sleep, withRetry, randomUserAgent } from "./ratelimit";
import { parseSearchResults, findAppsInResults, platformToEntity, type ITunesSearchResponse } from "./parser";

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

export interface CompetitorResult {
  appStoreId: string;
  keyword: string;
  store: string;
  rank: number | null;
  checkedAt: Date;
}

export interface CheckMultipleResult {
  results: Array<RankResult & { keywordId: number }>;
  competitorResults: CompetitorResult[];
}

export async function checkMultiple(
  checks: CheckInput[],
  onProgress?: ProgressCallback,
  competitorAppIds?: string[]
): Promise<CheckMultipleResult> {
  const results: Array<RankResult & { keywordId: number }> = [];
  const competitorResults: CompetitorResult[] = [];

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

    // Extract competitor ranks from the same response (zero extra API calls)
    if (competitorAppIds && competitorAppIds.length > 0) {
      const competitorRanks = findAppsInResults(response, competitorAppIds);
      for (const [appStoreId, rank] of competitorRanks) {
        competitorResults.push({
          appStoreId,
          keyword: first.keyword,
          store: first.store,
          rank,
          checkedAt,
        });
      }
    }

    // Add delay between requests (except for the last one)
    if (i < groups.length - 1) {
      await sleep(randomDelay());
    }
  }

  return { results, competitorResults };
}

// Full app details from App Store
export interface AppDetails {
  trackId: number;
  bundleId: string;
  trackName: string;
  description: string;
  artistName: string;
  artistId: number;
  artistUrl: string;
  sellerName: string;
  sellerUrl?: string;
  price: number;
  currency: string;
  formattedPrice: string;
  free: boolean;
  primaryGenreName: string;
  primaryGenreId: number;
  genres: string[];
  genreIds: string[];
  contentAdvisoryRating: string;
  trackContentRating: string;
  averageUserRating: number;
  averageUserRatingForCurrentVersion: number;
  userRatingCount: number;
  userRatingCountForCurrentVersion: number;
  version: string;
  releaseDate: string;
  currentVersionReleaseDate: string;
  releaseNotes?: string;
  minimumOsVersion: string;
  fileSizeBytes: string;
  artworkUrl60: string;
  artworkUrl100: string;
  artworkUrl512: string;
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
  trackViewUrl: string;
  supportedDevices: string[];
  languageCodesISO2A: string[];
  features: string[];
}

export async function lookupAppDetails(
  appId: string,
  store: string = "us"
): Promise<AppDetails | null> {
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

      return res.json() as Promise<{ resultCount: number; results: Record<string, unknown>[] }>;
    });

    if (response.resultCount > 0 && response.results[0]) {
      const r = response.results[0];
      return {
        trackId: r.trackId as number,
        bundleId: r.bundleId as string,
        trackName: r.trackName as string,
        description: r.description as string,
        artistName: r.artistName as string,
        artistId: r.artistId as number,
        artistUrl: r.artistViewUrl as string,
        sellerName: r.sellerName as string,
        sellerUrl: r.sellerUrl as string | undefined,
        price: r.price as number,
        currency: r.currency as string,
        formattedPrice: r.formattedPrice as string,
        free: (r.price as number) === 0,
        primaryGenreName: r.primaryGenreName as string,
        primaryGenreId: r.primaryGenreId as number,
        genres: r.genres as string[],
        genreIds: r.genreIds as string[],
        contentAdvisoryRating: r.contentAdvisoryRating as string,
        trackContentRating: r.trackContentRating as string,
        averageUserRating: r.averageUserRating as number,
        averageUserRatingForCurrentVersion: r.averageUserRatingForCurrentVersion as number,
        userRatingCount: r.userRatingCount as number,
        userRatingCountForCurrentVersion: r.userRatingCountForCurrentVersion as number,
        version: r.version as string,
        releaseDate: r.releaseDate as string,
        currentVersionReleaseDate: r.currentVersionReleaseDate as string,
        releaseNotes: r.releaseNotes as string | undefined,
        minimumOsVersion: r.minimumOsVersion as string,
        fileSizeBytes: r.fileSizeBytes as string,
        artworkUrl60: r.artworkUrl60 as string,
        artworkUrl100: r.artworkUrl100 as string,
        artworkUrl512: r.artworkUrl512 as string,
        screenshotUrls: r.screenshotUrls as string[],
        ipadScreenshotUrls: r.ipadScreenshotUrls as string[],
        trackViewUrl: r.trackViewUrl as string,
        supportedDevices: r.supportedDevices as string[],
        languageCodesISO2A: r.languageCodesISO2A as string[],
        features: r.features as string[],
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Utility to get basic app info from App Store
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
