import {
  listApps,
  getAppByAppId,
  createApp,
  updateApp,
  deleteApp,
  listKeywords,
  addKeyword,
  deleteKeyword,
  getCurrentRankings,
  getMovers,
  getRankingHistory,
  getLatestRatings,
  getRatingHistory,
  listReviews,
  getReviewStats,
  getStats,
  addRanking,
  addRating as addRatingDb,
  setMetadata,
  getStaleRatingChecks,
  type KeywordWithLastCheck,
} from "../db";
import {
  searchAppStore,
  searchKeyword,
  lookupAppDetails,
  checkMultiple,
  type CheckProgress,
} from "../scraper/appstore";
import {
  fetchMultipleRatings,
  type RatingCheckProgress,
} from "../scraper/ratings";
import { findKeywords, discoverKeywords } from "../scraper/finder";
import { CONFIG, type Platform } from "../config";
import homepage from "./index.html";

// ============ Background check state ============

interface CheckState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  progress: {
    phase: "idle" | "keywords" | "ratings" | "done" | "error";
    total: number;
    completed: number;
    current: string;
  };
  result: {
    keywordsChecked: number;
    keywordsSkipped: number;
    keywordsFound: number;
    ratingsChecked: number;
    elapsed: string;
  } | null;
  error: string | null;
}

let checkState: CheckState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  progress: { phase: "idle", total: 0, completed: 0, current: "" },
  result: null,
  error: null,
};

// ============ Route matching helpers ============

function matchRoute(
  pathname: string,
  pattern: string
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]!;
    const pathPart = pathParts[i]!;

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

function getQuery(url: URL): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    query[key] = value;
  }
  return query;
}

// ============ JSON response helpers ============

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: CORS_HEADERS });
}

function jsonError(message: string, status: number = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: CORS_HEADERS,
  });
}

// ============ Background check runner ============

async function runBackgroundCheck(options: {
  appId?: string;
  store?: string;
  force?: boolean;
}): Promise<void> {
  const startTime = Date.now();

  checkState = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    progress: { phase: "keywords", total: 0, completed: 0, current: "Starting..." },
    result: null,
    error: null,
  };

  let keywordsChecked = 0;
  let keywordsSkipped = 0;
  let keywordsFound = 0;
  let ratingsChecked = 0;

  try {
    // ── Keywords ──
    const keywords = (await listKeywords({
      appId: options.appId,
      store: options.store,
      trackKeywords: true,
      includeLastCheck: true,
    })) as KeywordWithLastCheck[];

    if (keywords.length > 0) {
      const refreshIntervalMs =
        CONFIG.scraper.refreshIntervalHours * 60 * 60 * 1000;
      const now = Date.now();

      const staleKeywords = options.force
        ? keywords
        : keywords.filter((k) => {
            if (!k.last_checked_at) return true;
            const lastCheck = new Date(k.last_checked_at).getTime();
            return now - lastCheck >= refreshIntervalMs;
          });

      keywordsSkipped = keywords.length - staleKeywords.length;

      if (staleKeywords.length > 0) {
        const checks = staleKeywords.map((k) => ({
          appId: k.app_store_id,
          keyword: k.keyword,
          store: k.store,
          platform: k.platform as Platform,
          keywordId: k.id,
        }));

        checkState.progress.total = checks.length;

        const onProgress = (progress: CheckProgress) => {
          checkState.progress = {
            phase: "keywords",
            total: progress.total,
            completed: progress.completed,
            current: `${progress.current.keyword} (${progress.current.store})`,
          };
        };

        const results = await checkMultiple(checks, onProgress);

        for (const result of results) {
          await addRanking(result.keywordId, result.rank);
        }

        keywordsChecked = results.length;
        keywordsFound = results.filter((r) => r.rank !== null).length;
      }
    }

    // ── Ratings ──
    checkState.progress = {
      phase: "ratings",
      total: 0,
      completed: 0,
      current: "Fetching ratings...",
    };

    const staleRatings = await getStaleRatingChecks({
      appId: options.appId,
      store: options.store,
      force: options.force,
      refreshIntervalHours: CONFIG.scraper.refreshIntervalHours,
    });

    if (staleRatings.length > 0) {
      const ratingChecks = staleRatings.map((r) => ({
        appId: r.app_store_id,
        store: r.store,
        appName: r.app_name ?? r.app_store_id,
        dbAppId: r.app_id,
      }));

      checkState.progress.total = ratingChecks.length;

      const onRatingProgress = (progress: RatingCheckProgress) => {
        checkState.progress = {
          phase: "ratings",
          total: progress.total,
          completed: progress.completed,
          current: `${progress.current.appName} (${progress.current.store})`,
        };
      };

      const ratingResults = await fetchMultipleRatings(
        ratingChecks,
        onRatingProgress
      );

      for (const r of ratingResults) {
        if (r.score !== null || r.ratingsCount !== null) {
          await addRatingDb(r.dbAppId, r.store, r.score, r.ratingsCount, r.histogram);
          ratingsChecked++;
        }
      }
    }

    // ── Done ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    await setMetadata("last_check", new Date().toISOString());

    checkState = {
      running: false,
      startedAt: checkState.startedAt,
      finishedAt: new Date().toISOString(),
      progress: { phase: "done", total: 0, completed: 0, current: "" },
      result: {
        keywordsChecked,
        keywordsSkipped,
        keywordsFound,
        ratingsChecked,
        elapsed: `${elapsed}s`,
      },
      error: null,
    };
  } catch (err) {
    checkState = {
      running: false,
      startedAt: checkState.startedAt,
      finishedAt: new Date().toISOString(),
      progress: {
        phase: "error",
        total: checkState.progress.total,
        completed: checkState.progress.completed,
        current: "",
      },
      result: null,
      error: String(err),
    };
  }
}

// ============ API request handler ============

async function handleApiRequest(req: Request, url: URL): Promise<Response> {
  const { pathname } = url;
  const query = getQuery(url);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // ── GET /api/stats ──
    if (req.method === "GET" && pathname === "/api/stats") {
      const stats = await getStats();
      return json(stats);
    }

    // ── GET /api/apps ──
    if (req.method === "GET" && pathname === "/api/apps") {
      const apps = await listApps({
        isOwn: query.is_own !== undefined ? query.is_own === "true" : undefined,
        platform: query.platform,
      });
      return json(apps);
    }

    // ── POST /api/apps ──
    if (req.method === "POST" && pathname === "/api/apps") {
      const body = (await req.json()) as {
        appId?: string;
        platform?: string;
        name?: string;
        developer?: string;
        isOwn?: boolean;
        trackKeywords?: boolean;
        trackRatings?: boolean;
        trackReviews?: boolean;
      };
      if (!body.appId) {
        return jsonError("appId is required");
      }
      if (!body.platform) {
        return jsonError("platform is required");
      }
      if (!CONFIG.platforms.includes(body.platform as Platform)) {
        return jsonError(
          `Invalid platform. Must be one of: ${CONFIG.platforms.join(", ")}`
        );
      }
      const app = await createApp(
        body.appId,
        body.platform as Platform,
        body.name,
        body.developer,
        {
          isOwn: body.isOwn,
          trackKeywords: body.trackKeywords,
          trackRatings: body.trackRatings,
          trackReviews: body.trackReviews,
        }
      );
      return json(app, 201);
    }

    // ── PUT /api/apps/:appId ──
    {
      const params = matchRoute(pathname, "/api/apps/:appId");
      if (req.method === "PUT" && params) {
        const body = (await req.json()) as {
          isOwn?: boolean;
          trackKeywords?: boolean;
          trackRatings?: boolean;
          trackReviews?: boolean;
          name?: string;
          developer?: string;
        };
        const updated = await updateApp(params.appId!, body);
        if (!updated) {
          return jsonError("App not found", 404);
        }
        return json(updated);
      }
    }

    // ── DELETE /api/apps/:appId ──
    {
      const params = matchRoute(pathname, "/api/apps/:appId");
      if (req.method === "DELETE" && params) {
        const deleted = await deleteApp(params.appId!);
        if (!deleted) {
          return jsonError("App not found", 404);
        }
        return json({ deleted: true });
      }
    }

    // ── GET /api/apps/:appId/details ──
    {
      const params = matchRoute(pathname, "/api/apps/:appId/details");
      if (req.method === "GET" && params) {
        const details = await lookupAppDetails(params.appId!, query.store);
        if (!details) {
          return jsonError("App not found in App Store", 404);
        }
        return json(details);
      }
    }

    // ── GET /api/apps/:appId ──
    {
      const params = matchRoute(pathname, "/api/apps/:appId");
      if (req.method === "GET" && params) {
        const app = await getAppByAppId(params.appId!);
        if (!app) {
          return jsonError("App not found", 404);
        }
        return json(app);
      }
    }

    // ── GET /api/keywords ──
    if (req.method === "GET" && pathname === "/api/keywords") {
      const keywords = await listKeywords({
        appId: query.appId,
        store: query.store,
        platform: query.platform,
        isOwn: query.isOwn !== undefined ? query.isOwn === "true" : undefined,
        includeLastCheck: true,
      });
      return json(keywords);
    }

    // ── POST /api/keywords ──
    if (req.method === "POST" && pathname === "/api/keywords") {
      const body = (await req.json()) as {
        appId?: string;
        keyword?: string;
        store?: string;
      };
      if (!body.appId || !body.keyword || !body.store) {
        return jsonError("appId, keyword, and store are required");
      }
      if (!CONFIG.stores.includes(body.store.toLowerCase() as (typeof CONFIG.stores)[number])) {
        return jsonError(`Invalid store: ${body.store}`);
      }
      try {
        const keyword = await addKeyword(body.appId, body.keyword, body.store.toLowerCase());
        return json(keyword, 201);
      } catch (err) {
        return jsonError(String(err), 400);
      }
    }

    // ── DELETE /api/keywords/:id ──
    {
      const params = matchRoute(pathname, "/api/keywords/:id");
      if (req.method === "DELETE" && params) {
        const deleted = await deleteKeyword(Number(params.id));
        if (!deleted) {
          return jsonError("Keyword not found", 404);
        }
        return json({ deleted: true });
      }
    }

    // ── GET /api/rankings/movers ──
    if (req.method === "GET" && pathname === "/api/rankings/movers") {
      const movers = await getMovers({
        days: query.days ? Number(query.days) : undefined,
        minChange: query.minChange ? Number(query.minChange) : undefined,
      });
      return json(movers);
    }

    // ── GET /api/rankings/history/:keywordId ──
    {
      const params = matchRoute(pathname, "/api/rankings/history/:keywordId");
      if (req.method === "GET" && params) {
        const history = await getRankingHistory(
          Number(params.keywordId),
          query.days ? Number(query.days) : undefined
        );
        return json(history);
      }
    }

    // ── GET /api/rankings ──
    if (req.method === "GET" && pathname === "/api/rankings") {
      const rankings = await getCurrentRankings({
        appId: query.appId,
        keyword: query.keyword,
        store: query.store,
        platform: query.platform,
        sort: query.sort as "rank" | "keyword" | "store" | "app" | "change" | "checked" | undefined,
        desc: query.desc === "true",
      });
      return json(rankings);
    }

    // ── GET /api/ratings/history/:appId ──
    {
      const params = matchRoute(pathname, "/api/ratings/history/:appId");
      if (req.method === "GET" && params) {
        const history = await getRatingHistory(
          params.appId!,
          query.store,
          query.days ? Number(query.days) : undefined
        );
        return json(history);
      }
    }

    // ── GET /api/ratings ──
    if (req.method === "GET" && pathname === "/api/ratings") {
      const ratings = await getLatestRatings({
        appId: query.appId,
        store: query.store,
        platform: query.platform,
      });
      return json(ratings);
    }

    // ── GET /api/reviews/stats ──
    if (req.method === "GET" && pathname === "/api/reviews/stats") {
      const stats = await getReviewStats({
        appId: query.appId,
        store: query.store,
        days: query.days ? Number(query.days) : undefined,
      });
      return json(stats);
    }

    // ── GET /api/reviews ──
    if (req.method === "GET" && pathname === "/api/reviews") {
      const reviews = await listReviews({
        appId: query.appId,
        store: query.store,
        platform: query.platform,
        minScore: query.minScore ? Number(query.minScore) : undefined,
        maxScore: query.maxScore ? Number(query.maxScore) : undefined,
        days: query.days ? Number(query.days) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      });
      return json(reviews);
    }

    // ── GET /api/stores ──
    if (req.method === "GET" && pathname === "/api/stores") {
      return json(CONFIG.stores);
    }

    // ── GET /api/platforms ──
    if (req.method === "GET" && pathname === "/api/platforms") {
      return json(CONFIG.platforms);
    }

    // ── GET /api/search ──
    if (req.method === "GET" && pathname === "/api/search") {
      if (!query.q) {
        return jsonError("q (search query) is required");
      }
      const raw = await searchAppStore(
        query.q,
        query.store ?? "us",
        (query.platform ?? "iphone") as Platform
      );
      const results = (raw as any[]).map((r: any) => ({
        id: r.trackId ?? r.id,
        appId: String(r.trackId ?? r.appId ?? r.id),
        title: r.trackName ?? r.title ?? "",
        developer: r.artistName ?? r.developer ?? "",
        icon: r.artworkUrl100 ?? r.artworkUrl60 ?? r.icon ?? "",
        score: r.averageUserRating ?? r.score ?? 0,
        url: r.trackViewUrl ?? r.url ?? "",
        price: r.price ?? 0,
        free: (r.price ?? 0) === 0,
      }));
      return json(results);
    }

    // ── GET /api/keyword-apps?keyword=...&store=...&platform=... ──
    if (req.method === "GET" && pathname === "/api/keyword-apps") {
      if (!query.keyword) return jsonError("keyword is required");
      const store = query.store ?? "us";
      const platform = (query.platform ?? "iphone") as Platform;
      const response = await searchKeyword(query.keyword, store, platform);
      const results = (response.results ?? []).map((r: any, idx: number) => ({
        rank: idx + 1,
        appId: String(r.trackId),
        title: r.trackName ?? "",
        developer: r.artistName ?? "",
        icon: r.artworkUrl100 ?? r.artworkUrl60 ?? "",
        score: r.averageUserRating ?? 0,
        url: r.trackViewUrl ?? "",
        price: r.price ?? 0,
        free: (r.price ?? 0) === 0,
      }));
      return json(results);
    }

    // ── GET /api/discover/find ──
    if (req.method === "GET" && pathname === "/api/discover/find") {
      if (!query.seed) {
        return jsonError("seed is required");
      }
      const result = await findKeywords({
        seed: query.seed,
        store: query.store ?? "us",
        platform: (query.platform ?? "iphone") as Platform,
        limit: query.limit ? Number(query.limit) : 20,
        depth: (query.depth ?? "shallow") as "shallow" | "deep",
        minApps: query.minApps ? Number(query.minApps) : 2,
        topApps: query.topApps ? Number(query.topApps) : 10,
        compareAppId: query.compareAppId,
      });
      return json(result);
    }

    // ── GET /api/discover/opportunities ──
    if (req.method === "GET" && pathname === "/api/discover/opportunities") {
      if (!query.appId) {
        return jsonError("appId is required");
      }
      const result = await discoverKeywords({
        appId: query.appId,
        store: query.store ?? "us",
        platform: (query.platform ?? "iphone") as Platform,
        limit: query.limit ? Number(query.limit) : 20,
        depth: (query.depth ?? "shallow") as "shallow" | "deep",
        minApps: query.minApps ? Number(query.minApps) : 2,
        topApps: query.topApps ? Number(query.topApps) : 10,
      });
      return json(result);
    }

    // ── GET /api/competitors/:appId ──
    {
      const params = matchRoute(pathname, "/api/competitors/:appId");
      if (req.method === "GET" && params) {
        // Get all keywords tracked by this app
        const keywords = await listKeywords({ appId: params.appId! });

        if (keywords.length === 0) {
          return json({ competitors: [] });
        }

        // For each unique keyword+store combo, get the current rankings
        const competitorMap = new Map<
          string,
          {
            appId: string;
            appName: string | null;
            platform: string;
            sharedKeywords: number;
            rankDiffs: number[];
          }
        >();

        for (const kw of keywords) {
          const rankings = await getCurrentRankings({
            keyword: kw.keyword,
            store: kw.store,
          });

          // Find the tracked app's rank for this keyword
          const ownRanking = rankings.find(
            (r) => r.app_store_id === params.appId!
          );
          const ownRank = ownRanking?.current_rank;

          for (const ranking of rankings) {
            // Skip the app itself
            if (ranking.app_store_id === params.appId!) continue;

            const key = ranking.app_store_id;
            let competitor = competitorMap.get(key);
            if (!competitor) {
              competitor = {
                appId: ranking.app_store_id,
                appName: ranking.app_name,
                platform: ranking.platform,
                sharedKeywords: 0,
                rankDiffs: [],
              };
              competitorMap.set(key, competitor);
            }

            competitor.sharedKeywords++;
            if (
              ownRank !== null &&
              ownRank !== undefined &&
              ranking.current_rank !== null
            ) {
              competitor.rankDiffs.push(ownRank - ranking.current_rank);
            }
          }
        }

        const competitors = Array.from(competitorMap.values())
          .map((c) => ({
            appId: c.appId,
            appName: c.appName,
            platform: c.platform,
            sharedKeywords: c.sharedKeywords,
            avgRankDiff:
              c.rankDiffs.length > 0
                ? Math.round(
                    (c.rankDiffs.reduce((sum, d) => sum + d, 0) /
                      c.rankDiffs.length) *
                      10
                  ) / 10
                : 0,
          }))
          .sort((a, b) => b.sharedKeywords - a.sharedKeywords);

        return json({ competitors });
      }
    }

    // ── POST /api/check/run ──
    if (req.method === "POST" && pathname === "/api/check/run") {
      if (checkState.running) {
        return json({ status: "already_running", check: checkState }, 409);
      }

      const body = (await req.json().catch(() => ({}))) as {
        appId?: string;
        store?: string;
        force?: boolean;
      };

      // Fire and forget -- don't await
      runBackgroundCheck({
        appId: body.appId,
        store: body.store,
        force: body.force,
      });

      return json({ status: "started", startedAt: checkState.startedAt });
    }

    // ── GET /api/check/status ──
    if (req.method === "GET" && pathname === "/api/check/status") {
      return json(checkState);
    }

    // No API route matched
    return jsonError("Not found", 404);
  } catch (error) {
    console.error("API error:", error);
    return json({ error: String(error) }, 500);
  }
}

// ============ Server entry point ============

export function startServer(port: number): {
  server: ReturnType<typeof Bun.serve>;
  port: number;
} {
  const server = Bun.serve({
    port,
    routes: {
      "/": homepage,
    },
    fetch(req) {
      const url = new URL(req.url);

      // API routes
      if (url.pathname.startsWith("/api/")) {
        return handleApiRequest(req, url);
      }

      // SPA fallback: serve the homepage for all non-API routes
      // This supports hash-based routing (#/apps, #/keywords, etc.)
      return new Response(Bun.file(new URL("./index.html", import.meta.url).pathname), {
        headers: { "Content-Type": "text/html" },
      });
    },
    development: {
      hmr: true,
    },
  });

  return { server, port: server.port ?? port };
}
