// ============ Types ============

export interface Stats {
  appCount: number;
  keywordCount: number;
  rankingCount: number;
  storeCount: number;
  lastCheck: string | null;
}

export interface App {
  id: number;
  app_id: string;
  name: string | null;
  developer: string | null;
  platform: string;
  is_own: number;
  track_keywords: number;
  track_ratings: number;
  track_reviews: number;
  created_at: string;
}

export interface KeywordCandidate {
  keyword: string;
  frequency: number;
  frequencyPct: number;
  score: number;
  foundIn: string[];
  wordCount: number;
  longTail: boolean;
  sources: { appId: string; appName: string; rank: number }[];
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

export interface CompetitorOverview {
  appId: string;
  appName: string | null;
  platform: string;
  sharedKeywords: number;
  avgRankDiff: number;
}

export interface AppDetails {
  id: number;
  app_id: string;
  name: string;
  developer: string;
  platform: string;
  icon: string;
  description: string;
  url: string;
  price: number;
  currency: string;
  score: number;
  ratings: number;
  reviews: number;
  currentVersionScore: number;
  currentVersionReviews: number;
  version: string;
  size: string;
  requiredOsVersion: string;
  released: string;
  updated: string;
  genres: string[];
}

export interface Keyword {
  id: number;
  app_id: number;
  keyword: string;
  store: string;
  created_at: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
  last_checked_at: string | null;
}

export interface Ranking {
  keyword_id: number;
  keyword: string;
  store: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
  current_rank: number | null;
  previous_rank: number | null;
  rank_change: number | null;
  checked_at: string;
}

export interface HistoryPoint {
  id: number;
  keyword_id: number;
  rank: number | null;
  checked_at: string;
}

export interface Rating {
  id: number;
  app_id: number;
  store: string;
  score: number | null;
  ratings_count: number | null;
  stars_1: number | null;
  stars_2: number | null;
  stars_3: number | null;
  stars_4: number | null;
  stars_5: number | null;
  checked_at: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
  previous_score: number | null;
  score_change: number | null;
  previous_count: number | null;
  count_change: number | null;
}

export interface RatingHistory {
  id: number;
  app_id: number;
  store: string;
  score: number | null;
  ratings_count: number | null;
  stars_1: number | null;
  stars_2: number | null;
  stars_3: number | null;
  stars_4: number | null;
  stars_5: number | null;
  checked_at: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
}

export interface Review {
  id: number;
  app_id: number;
  store: string;
  review_id: string;
  author: string | null;
  title: string | null;
  text: string | null;
  score: number;
  version: string | null;
  updated_at: string | null;
  fetched_at: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
}

export interface ReviewStats {
  total: number;
  averageScore: number;
  distribution: Record<number, number>;
  recentCount: number;
  recentAverageScore: number;
}

export interface SearchResult {
  id: number;
  appId: string;
  title: string;
  developer: string;
  icon: string;
  score: number;
  url: string;
  price: number;
  free: boolean;
}

export interface KeywordApp {
  rank: number;
  appId: string;
  title: string;
  developer: string;
  icon: string;
  score: number;
  url: string;
  price: number;
  free: boolean;
}

export interface CompetitorRankingEntry {
  app_id: number;
  keyword: string;
  store: string;
  rank: number | null;
  checked_at: string;
  app_store_id: string;
  app_name: string | null;
  platform: string;
  previous_rank: number | null;
  rank_change: number | null;
}

export interface CheckStatus {
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

// ============ API Client ============

const BASE = "";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function toQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, v]) => v != null);
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export const api = {
  getStats: () => fetchApi<Stats>("/api/stats"),

  getApps: (params?: { isOwn?: boolean; platform?: string }) =>
    fetchApi<App[]>(`/api/apps${toQuery(params ? { is_own: params.isOwn, platform: params.platform } : undefined)}`),

  createApp: (data: { appId: string; platform: string; name?: string; developer?: string; isOwn?: boolean; trackKeywords?: boolean; trackRatings?: boolean; trackReviews?: boolean }) =>
    fetchApi<App>("/api/apps", { method: "POST", body: JSON.stringify(data) }),

  updateApp: (appId: string, data: { isOwn?: boolean; trackKeywords?: boolean; trackRatings?: boolean; trackReviews?: boolean; name?: string; developer?: string }) =>
    fetchApi<App>(`/api/apps/${appId}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteApp: (appId: string) => fetchApi<void>(`/api/apps/${appId}`, { method: "DELETE" }),

  getApp: (appId: string) => fetchApi<App>(`/api/apps/${appId}`),

  getAppDetails: (appId: string, store?: string) =>
    fetchApi<AppDetails>(`/api/apps/${appId}/details${store ? `?store=${store}` : ""}`),

  getKeywords: (params?: { appId?: string; store?: string; platform?: string; isOwn?: boolean }) =>
    fetchApi<Keyword[]>(`/api/keywords${toQuery(params)}`),

  addKeyword: (data: { appId: string; keyword: string; store: string }) =>
    fetchApi<Keyword>("/api/keywords", { method: "POST", body: JSON.stringify(data) }),

  deleteKeyword: (id: number) => fetchApi<void>(`/api/keywords/${id}`, { method: "DELETE" }),

  getRankings: (params?: { appId?: string; keyword?: string; store?: string; platform?: string; sort?: string; desc?: boolean }) =>
    fetchApi<Ranking[]>(`/api/rankings${toQuery(params)}`),

  getMovers: (params?: { days?: number; minChange?: number }) =>
    fetchApi<Ranking[]>(`/api/rankings/movers${toQuery(params)}`),

  getRankingHistory: (keywordId: number, days?: number) =>
    fetchApi<HistoryPoint[]>(`/api/rankings/history/${keywordId}${days ? `?days=${days}` : ""}`),

  getRatings: (params?: { appId?: string; store?: string; platform?: string }) =>
    fetchApi<Rating[]>(`/api/ratings${toQuery(params)}`),

  getRatingHistory: (appId: string, params?: { store?: string; days?: number }) =>
    fetchApi<RatingHistory[]>(`/api/ratings/history/${appId}${toQuery(params)}`),

  getReviews: (params?: { appId?: string; store?: string; platform?: string; minScore?: number; maxScore?: number; days?: number; limit?: number }) =>
    fetchApi<Review[]>(`/api/reviews${toQuery(params)}`),

  getReviewStats: (params?: { appId?: string; store?: string; days?: number }) =>
    fetchApi<ReviewStats>(`/api/reviews/stats${toQuery(params)}`),

  getStores: () => fetchApi<string[]>("/api/stores"),

  getPlatforms: () => fetchApi<string[]>("/api/platforms"),

  search: (q: string, store?: string, platform?: string) =>
    fetchApi<SearchResult[]>(
      `/api/search?q=${encodeURIComponent(q)}${store ? `&store=${store}` : ""}${platform ? `&platform=${platform}` : ""}`
    ),

  // Keyword discovery
  findKeywords: (params: { seed: string; store?: string; platform?: string; limit?: number; depth?: string; minApps?: number; topApps?: number; compareAppId?: string }) =>
    fetchApi<KeywordFinderResult>(`/api/discover/find${toQuery(params)}`),

  discoverOpportunities: (params: { appId: string; store?: string; platform?: string; limit?: number; depth?: string; minApps?: number; topApps?: number }) =>
    fetchApi<KeywordFinderResult>(`/api/discover/opportunities${toQuery(params)}`),

  // Keyword top apps
  getKeywordApps: (params: { keyword: string; store?: string; platform?: string }) =>
    fetchApi<KeywordApp[]>(`/api/keyword-apps${toQuery(params)}`),

  // Competitors
  getCompetitors: (appId: string) =>
    fetchApi<{ competitors: CompetitorOverview[] }>(`/api/competitors/${appId}`),

  // Linked competitors
  getLinkedCompetitors: (ownAppId: number) =>
    fetchApi<App[]>(`/api/apps/${ownAppId}/competitors`),

  linkCompetitor: (ownAppId: number, competitorAppId: number) =>
    fetchApi<{ linked: boolean }>(`/api/apps/${ownAppId}/competitors`, {
      method: "POST",
      body: JSON.stringify({ competitorAppId }),
    }),

  unlinkCompetitor: (ownAppId: number, competitorAppId: number) =>
    fetchApi<{ unlinked: boolean }>(`/api/apps/${ownAppId}/competitors/${competitorAppId}`, {
      method: "DELETE",
    }),

  getCompetitorRankings: (params?: { appId?: string; keyword?: string; store?: string; days?: number }) =>
    fetchApi<CompetitorRankingEntry[]>(`/api/competitor-rankings${toQuery(params)}`),

  runCheck: (data?: { appId?: string; store?: string; force?: boolean }) =>
    fetchApi<{ status: string }>("/api/check/run", { method: "POST", body: JSON.stringify(data ?? {}) }),

  getCheckStatus: () => fetchApi<CheckStatus>("/api/check/status"),
};
