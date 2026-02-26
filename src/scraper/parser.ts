import type { Platform } from "../config";

export interface SearchResult {
  trackId: number;
  trackName: string;
  bundleId: string;
  artistName: string;
  position: number;
}

export interface ITunesSearchResponse {
  resultCount: number;
  results: Array<{
    trackId: number;
    trackName: string;
    bundleId: string;
    artistName: string;
    kind?: string;
    wrapperType?: string;
  }>;
}

export function parseSearchResults(
  data: ITunesSearchResponse,
  targetAppId: string
): { rank: number | null; results: SearchResult[] } {
  const results: SearchResult[] = [];
  let rank: number | null = null;

  data.results.forEach((item, index) => {
    const position = index + 1;

    results.push({
      trackId: item.trackId,
      trackName: item.trackName,
      bundleId: item.bundleId,
      artistName: item.artistName,
      position,
    });

    // Check if this is our target app
    if (String(item.trackId) === targetAppId) {
      rank = position;
    }
  });

  return { rank, results };
}

/**
 * Find ranks for multiple app IDs in a single search response.
 * Returns a map of appId → rank (or null if not found).
 */
export function findAppsInResults(
  data: ITunesSearchResponse,
  appIds: string[]
): Map<string, number | null> {
  const idSet = new Set(appIds);
  const ranks = new Map<string, number | null>();

  // Initialize all as null (not found)
  for (const id of appIds) {
    ranks.set(id, null);
  }

  data.results.forEach((item, index) => {
    const trackIdStr = String(item.trackId);
    if (idSet.has(trackIdStr)) {
      ranks.set(trackIdStr, index + 1);
    }
  });

  return ranks;
}

// Map our platform names to iTunes entity parameter values
export function platformToEntity(platform: Platform): string {
  switch (platform) {
    case "iphone":
    case "ipad":
      return "software";
    case "mac":
      return "macSoftware";
    case "appletv":
      return "tvSoftware";
    case "watch":
      return "software"; // Watch apps are bundled with iOS apps
    default:
      return "software";
  }
}

// Map platform to iTunes media parameter
export function platformToMedia(platform: Platform): string {
  switch (platform) {
    case "mac":
      return "software";
    default:
      return "software";
  }
}
