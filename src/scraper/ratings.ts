import appStore from "app-store-scraper";
import { randomDelay, sleep, withRetry } from "./ratelimit";

export interface RatingResult {
  appId: string;
  store: string;
  score: number | null;
  ratingsCount: number | null;
  histogram: Record<number, number> | null;
}

export async function fetchRatings(
  appId: string,
  store: string
): Promise<RatingResult> {
  const result = await withRetry(async () => {
    return appStore.app({
      id: appId,
      country: store,
      ratings: true,
    });
  });

  return {
    appId,
    store,
    score: result.score ?? null,
    ratingsCount: result.ratings ?? null,
    histogram: result.histogram ?? null,
  };
}

export interface ReviewResult {
  id: string;
  author: string;
  title: string;
  text: string;
  score: number;
  version: string | null;
  updated: string;
}

export async function fetchReviews(
  appId: string,
  store: string,
  options?: { num?: number; sort?: number; page?: number }
): Promise<ReviewResult[]> {
  const allReviews: ReviewResult[] = [];
  const targetNum = options?.num ?? 100;
  const maxPages = Math.min(Math.ceil(targetNum / 50), 10); // RSS caps at 10 pages

  for (let page = 1; page <= maxPages; page++) {
    if (allReviews.length >= targetNum) break;

    try {
      const reviews = await withRetry(async () => {
        return appStore.reviews({
          id: appId,
          country: store,
          sort: options?.sort ?? appStore.sort.RECENT,
          page,
        });
      });

      if (!reviews || reviews.length === 0) break;

      for (const r of reviews) {
        allReviews.push({
          id: String(r.id),
          author: r.userName ?? r.author ?? "",
          title: r.title ?? "",
          text: r.text ?? "",
          score: r.score,
          version: r.version ?? null,
          updated: r.updated ?? r.date ?? new Date().toISOString(),
        });
      }

      // Rate limit between pages
      if (page < maxPages && allReviews.length < targetNum) {
        await sleep(randomDelay());
      }
    } catch {
      break; // Stop on error (e.g., no more pages)
    }
  }

  return allReviews.slice(0, targetNum);
}

export interface RatingCheckProgress {
  total: number;
  completed: number;
  current: {
    appName: string;
    store: string;
  };
}

export type RatingProgressCallback = (progress: RatingCheckProgress) => void;

export async function fetchMultipleRatings(
  checks: Array<{ appId: string; store: string; appName: string; dbAppId: number }>,
  onProgress?: RatingProgressCallback
): Promise<Array<RatingResult & { dbAppId: number }>> {
  const results: Array<RatingResult & { dbAppId: number }> = [];

  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]!;

    if (onProgress) {
      onProgress({
        total: checks.length,
        completed: i,
        current: { appName: check.appName, store: check.store },
      });
    }

    try {
      const rating = await fetchRatings(check.appId, check.store);
      results.push({ ...rating, dbAppId: check.dbAppId });
    } catch {
      // Skip on error, continue with next
      results.push({
        appId: check.appId,
        store: check.store,
        score: null,
        ratingsCount: null,
        histogram: null,
        dbAppId: check.dbAppId,
      });
    }

    // Rate limit between requests (except last)
    if (i < checks.length - 1) {
      await sleep(randomDelay());
    }
  }

  return results;
}
