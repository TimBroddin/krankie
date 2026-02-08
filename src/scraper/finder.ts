import type { Platform } from "../config";
import { searchKeyword, lookupAppDetails, searchAppStore, type AppDetails } from "./appstore";
import { randomDelay, sleep } from "./ratelimit";

export interface KeywordFinderOptions {
  seed: string;
  store: string;
  platform: Platform;
  limit?: number;
  depth?: "shallow" | "deep";
  minApps?: number;
  topApps?: number;
  compareAppId?: string;
  onProgress?: (msg: string) => void;
}

export interface DiscoverOptions {
  appId: string;
  store: string;
  platform: Platform;
  limit?: number;
  depth?: "shallow" | "deep";
  minApps?: number;
  topApps?: number;
  onProgress?: (msg: string) => void;
}

export interface KeywordCandidate {
  keyword: string;
  frequency: number;
  frequencyPct: number;
  score: number;
  foundIn: ("title" | "description" | "genre")[];
  wordCount: number;
  longTail: boolean;
  sources: { appId: string; appName: string; rank: number }[];
  // Deep mode fields
  avgRank?: number;
  competition?: "low" | "medium" | "high";
}

export interface CompetitorInfo {
  appId: string;
  name: string;
  rank: number;
  developer: string;
  rating?: number;
}

export interface KeywordFinderResult {
  seed: string;
  store: string;
  platform: string;
  analyzedApps: number;
  apiCalls: number;
  elapsed: string;
  keywords: KeywordCandidate[];
  competitors: CompetitorInfo[];
  compareRank?: number | null;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "this", "that", "has", "have", "had", "not", "no", "do", "does",
  "did", "will", "would", "could", "should", "may", "can", "its",
  "app", "your", "you", "i", "my", "me", "we", "our", "us", "all",
  "new", "get", "more", "one", "also", "just", "so", "if", "up",
  "out", "about", "what", "which", "when", "how", "than", "them",
  "been", "each", "into", "over", "most", "very", "any", "only",
  "own", "many", "some", "such", "other", "they", "their", "then",
  "these", "those", "both", "per", "via", "now",
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNgrams(text: string, maxN: number): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter((w) => w.length >= 2);
  const ngrams: string[] = [];

  for (let n = 1; n <= Math.min(maxN, words.length); n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(" ");
      // Skip if all words are stop words
      const gramWords = gram.split(" ");
      if (gramWords.every((w) => STOP_WORDS.has(w))) continue;
      // Skip single-char grams or very long ones
      if (gram.length < 2 || gram.length > 50) continue;
      ngrams.push(gram);
    }
  }

  return ngrams;
}

interface ScoredGram {
  weight: number;
  source: "title" | "description" | "genre";
  appId: string;
  appName: string;
  rank: number;
}

function extractKeywordsFromApp(
  app: AppDetails,
  rank: number
): Map<string, ScoredGram[]> {
  const keywords = new Map<string, ScoredGram[]>();
  const appId = String(app.trackId);

  const addGrams = (grams: string[], weight: number, source: ScoredGram["source"]) => {
    for (const gram of grams) {
      const existing = keywords.get(gram) ?? [];
      existing.push({ weight, source, appId, appName: app.trackName, rank });
      keywords.set(gram, existing);
    }
  };

  // Title: high weight, up to 4-grams
  addGrams(extractNgrams(app.trackName, 4), 3.0, "title");

  // Description: first 500 chars, lower weight, up to 3-grams
  const descSnippet = app.description?.substring(0, 500) ?? "";
  addGrams(extractNgrams(descSnippet, 3), 1.0, "description");

  // Genre: use as-is
  if (app.primaryGenreName) {
    const genreGrams = extractNgrams(app.primaryGenreName, 2);
    addGrams(genreGrams, 0.5, "genre");
  }

  return keywords;
}

export async function findKeywords(
  options: KeywordFinderOptions
): Promise<KeywordFinderResult> {
  const {
    seed,
    store,
    platform,
    limit = 20,
    depth = "shallow",
    minApps = 2,
    topApps = 10,
    compareAppId,
    onProgress,
  } = options;

  const startTime = Date.now();
  let apiCalls = 0;

  // Step 1: Search for seed keyword
  onProgress?.(`Searching for "${seed}"...`);
  const searchResults = await searchKeyword(seed, store, platform);
  apiCalls++;

  const topResults = searchResults.results.slice(0, topApps);
  if (topResults.length === 0) {
    return {
      seed,
      store,
      platform,
      analyzedApps: 0,
      apiCalls,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      keywords: [],
      competitors: [],
    };
  }

  // Check if user's app is in results
  let compareRank: number | null | undefined;
  if (compareAppId) {
    const idx = searchResults.results.findIndex(
      (r) => String(r.trackId) === compareAppId
    );
    compareRank = idx >= 0 ? idx + 1 : null;
  }

  // Step 2: Fetch details for top apps
  const competitors: CompetitorInfo[] = [];
  const appDetails: (AppDetails & { rank: number })[] = [];

  for (let i = 0; i < topResults.length; i++) {
    const result = topResults[i]!;
    onProgress?.(`Analyzing app ${i + 1}/${topResults.length}: ${result.trackName}...`);

    await sleep(randomDelay());
    const details = await lookupAppDetails(String(result.trackId), store);
    apiCalls++;

    if (details) {
      appDetails.push({ ...details, rank: i + 1 });
      competitors.push({
        appId: String(result.trackId),
        name: result.trackName,
        rank: i + 1,
        developer: result.artistName,
        rating: details.averageUserRating,
      });
    }
  }

  // Step 3: Extract and aggregate keywords
  const aggregated = new Map<string, {
    totalWeight: number;
    apps: Set<string>;
    sources: Map<string, { appId: string; appName: string; rank: number }>;
    foundIn: Set<"title" | "description" | "genre">;
  }>();

  const seedNormalized = normalizeText(seed);

  for (const app of appDetails) {
    const appKeywords = extractKeywordsFromApp(app, app.rank);

    for (const [gram, entries] of appKeywords) {
      // Skip the seed keyword itself
      if (gram === seedNormalized) continue;

      let agg = aggregated.get(gram);
      if (!agg) {
        agg = { totalWeight: 0, apps: new Set(), sources: new Map(), foundIn: new Set() };
        aggregated.set(gram, agg);
      }

      for (const entry of entries) {
        agg.totalWeight += entry.weight;
        agg.apps.add(entry.appId);
        agg.foundIn.add(entry.source);
        if (!agg.sources.has(entry.appId)) {
          agg.sources.set(entry.appId, {
            appId: entry.appId,
            appName: entry.appName,
            rank: entry.rank,
          });
        }
      }
    }
  }

  // Step 4: Filter and score
  let candidates: KeywordCandidate[] = [];

  for (const [gram, agg] of aggregated) {
    if (agg.apps.size < minApps) continue;

    const wordCount = gram.split(" ").length;

    candidates.push({
      keyword: gram,
      frequency: agg.apps.size,
      frequencyPct: Math.round((agg.apps.size / appDetails.length) * 100),
      score: Math.round(agg.totalWeight * 10) / 10,
      foundIn: Array.from(agg.foundIn),
      wordCount,
      longTail: wordCount >= 3,
      sources: Array.from(agg.sources.values()),
    });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Step 5: Deep mode — verify rankings for top candidates
  if (depth === "deep" && candidates.length > 0) {
    const toVerify = candidates.slice(0, 10);
    onProgress?.(`Deep analysis: verifying rankings for ${toVerify.length} keywords...`);

    for (const candidate of toVerify) {
      await sleep(randomDelay());
      const results = await searchKeyword(candidate.keyword, store, platform);
      apiCalls++;

      const ranks = results.results
        .slice(0, 50)
        .map((_, idx) => idx + 1);

      if (ranks.length > 0) {
        candidate.avgRank = Math.round(
          ranks.reduce((sum, r) => sum + r, 0) / ranks.length
        );

        // Competition: based on how many results there are
        const resultCount = results.resultCount;
        if (resultCount < 50) candidate.competition = "low";
        else if (resultCount < 150) candidate.competition = "medium";
        else candidate.competition = "high";
      }
    }
  }

  // Limit results
  candidates = candidates.slice(0, limit);

  const elapsed = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  return {
    seed,
    store,
    platform,
    analyzedApps: appDetails.length,
    apiCalls,
    elapsed,
    keywords: candidates,
    competitors,
    compareRank,
  };
}

/**
 * Discover keywords for an app by analyzing its metadata and competitors.
 *
 * 1. Looks up the app to get its title/description
 * 2. Extracts seed keywords from the app's own metadata
 * 3. Searches iTunes for each seed to find competitors
 * 4. Extracts keywords from competitor metadata
 * 5. Returns keywords the app should consider targeting
 */
export async function discoverKeywords(
  options: DiscoverOptions
): Promise<KeywordFinderResult> {
  const {
    appId,
    store,
    platform,
    limit = 20,
    depth = "shallow",
    minApps = 2,
    topApps = 10,
    onProgress,
  } = options;

  const startTime = Date.now();
  let apiCalls = 0;

  // Step 1: Look up the app itself
  onProgress?.(`Looking up app ${appId}...`);
  const appDetails = await lookupAppDetails(appId, store);
  apiCalls++;

  if (!appDetails) {
    return {
      seed: `app:${appId}`,
      store,
      platform,
      analyzedApps: 0,
      apiCalls,
      elapsed: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      keywords: [],
      competitors: [],
    };
  }

  // Step 2: Extract seed keywords from app's own title
  const titleWords = normalizeText(appDetails.trackName)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  // Build 1-2 word seeds from the title
  const seeds: string[] = [];
  for (let n = 1; n <= Math.min(2, titleWords.length); n++) {
    for (let i = 0; i <= titleWords.length - n; i++) {
      const seed = titleWords.slice(i, i + n).join(" ");
      if (seed.length >= 3) seeds.push(seed);
    }
  }

  // Also add the genre as a seed
  if (appDetails.primaryGenreName) {
    seeds.push(normalizeText(appDetails.primaryGenreName));
  }

  // Deduplicate and limit seeds
  const uniqueSeeds = [...new Set(seeds)].slice(0, 5);

  onProgress?.(`Found ${uniqueSeeds.length} seed keywords from "${appDetails.trackName}"`);

  // Step 3: For each seed, search and gather competitors
  const allCompetitors = new Map<string, CompetitorInfo>();
  const allAppDetails: (AppDetails & { rank: number })[] = [];
  const processedAppIds = new Set<string>([appId]); // skip our own app

  for (let s = 0; s < uniqueSeeds.length; s++) {
    const seed = uniqueSeeds[s]!;
    onProgress?.(`Searching seed ${s + 1}/${uniqueSeeds.length}: "${seed}"...`);

    await sleep(randomDelay());
    const searchResults = await searchKeyword(seed, store, platform);
    apiCalls++;

    // Take top apps per seed (fewer per seed since we have multiple seeds)
    const perSeedLimit = Math.ceil(topApps / uniqueSeeds.length);
    const results = searchResults.results.slice(0, perSeedLimit);

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      const resultAppId = String(result.trackId);

      if (processedAppIds.has(resultAppId)) continue;
      processedAppIds.add(resultAppId);

      onProgress?.(`  Fetching details: ${result.trackName}...`);
      await sleep(randomDelay());
      const details = await lookupAppDetails(resultAppId, store);
      apiCalls++;

      if (details) {
        allAppDetails.push({ ...details, rank: i + 1 });
        allCompetitors.set(resultAppId, {
          appId: resultAppId,
          name: result.trackName,
          rank: i + 1,
          developer: result.artistName,
          rating: details.averageUserRating,
        });
      }
    }
  }

  // Step 4: Extract keywords from all competitor apps (reuse existing logic)
  const aggregated = new Map<string, {
    totalWeight: number;
    apps: Set<string>;
    sources: Map<string, { appId: string; appName: string; rank: number }>;
    foundIn: Set<"title" | "description" | "genre">;
  }>();

  // Normalize our own app's title to exclude it
  const ownTitleNormalized = normalizeText(appDetails.trackName);

  for (const app of allAppDetails) {
    const appKeywords = extractKeywordsFromApp(app, app.rank);

    for (const [gram, entries] of appKeywords) {
      // Skip keywords that are just our own app name
      if (gram === ownTitleNormalized) continue;
      // Skip seeds themselves
      if (uniqueSeeds.includes(gram)) continue;

      let agg = aggregated.get(gram);
      if (!agg) {
        agg = { totalWeight: 0, apps: new Set(), sources: new Map(), foundIn: new Set() };
        aggregated.set(gram, agg);
      }

      for (const entry of entries) {
        agg.totalWeight += entry.weight;
        agg.apps.add(entry.appId);
        agg.foundIn.add(entry.source);
        if (!agg.sources.has(entry.appId)) {
          agg.sources.set(entry.appId, {
            appId: entry.appId,
            appName: entry.appName,
            rank: entry.rank,
          });
        }
      }
    }
  }

  // Step 5: Filter and score
  let candidates: KeywordCandidate[] = [];

  for (const [gram, agg] of aggregated) {
    if (agg.apps.size < minApps) continue;

    const wordCount = gram.split(" ").length;

    candidates.push({
      keyword: gram,
      frequency: agg.apps.size,
      frequencyPct: Math.round((agg.apps.size / allAppDetails.length) * 100),
      score: Math.round(agg.totalWeight * 10) / 10,
      foundIn: Array.from(agg.foundIn),
      wordCount,
      longTail: wordCount >= 3,
      sources: Array.from(agg.sources.values()),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Deep mode
  if (depth === "deep" && candidates.length > 0) {
    const toVerify = candidates.slice(0, 10);
    onProgress?.(`Deep analysis: verifying rankings for ${toVerify.length} keywords...`);

    for (const candidate of toVerify) {
      await sleep(randomDelay());
      const results = await searchKeyword(candidate.keyword, store, platform);
      apiCalls++;

      // Check if OUR app ranks for this keyword
      const ourRankIdx = results.results.findIndex(
        (r) => String(r.trackId) === appId
      );

      const resultCount = results.resultCount;
      if (resultCount < 50) candidate.competition = "low";
      else if (resultCount < 150) candidate.competition = "medium";
      else candidate.competition = "high";

      if (ourRankIdx >= 0) {
        candidate.avgRank = ourRankIdx + 1; // reuse avgRank to show our rank
      }
    }
  }

  candidates = candidates.slice(0, limit);

  const elapsed = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

  return {
    seed: `app:${appId} (${appDetails.trackName})`,
    store,
    platform,
    analyzedApps: allAppDetails.length,
    apiCalls,
    elapsed,
    keywords: candidates,
    competitors: Array.from(allCompetitors.values()),
    compareRank: undefined,
  };
}
