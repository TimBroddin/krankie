import React, { useState, useEffect } from "react";
import { api, type Rating, type App } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { SkeletonCard } from "../components/ui/skeleton";

export function RatingsPage() {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");

  useEffect(() => {
    loadData();
  }, [filterApp, filterStore, filterPlatform]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [ratingsData, appsData] = await Promise.all([
        api.getRatings({
          appId: filterApp || undefined,
          store: filterStore || undefined,
          platform: filterPlatform || undefined,
        }),
        api.getApps(),
      ]);
      setRatings(ratingsData);
      setApps(appsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ratings");
    } finally {
      setLoading(false);
    }
  }

  const uniqueStores = [...new Set(ratings.map((r) => r.store))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ratings</h2>
          <p className="text-muted-foreground">App Store ratings and score distribution</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" className="mt-2" onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Select
          value={filterApp}
          onChange={(e) => setFilterApp(e.target.value)}
          placeholder="All Apps"
          options={apps.map((a) => ({ value: a.app_id, label: a.name || a.app_id }))}
          className="w-48"
        />
        <Select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          placeholder="All Stores"
          options={uniqueStores.map((s) => ({ value: s, label: s.toUpperCase() }))}
          className="w-32"
        />
        <Select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          placeholder="All Platforms"
          options={[
            { value: "iphone", label: "iPhone" },
            { value: "ipad", label: "iPad" },
            { value: "mac", label: "Mac" },
          ]}
          className="w-32"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : ratings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1.5L9.8 5.2L14 5.7L10.9 8.6L11.7 12.8L8 10.8L4.3 12.8L5.1 8.6L2 5.7L6.2 5.2Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No ratings data</h3>
              <p className="text-sm text-muted-foreground">
                Run a check to fetch ratings for your tracked apps.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {ratings.map((r) => (
            <RatingCard key={`${r.app_id}-${r.store}`} rating={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RatingCard({ rating }: { rating: Rating }) {
  const histogram = [
    { stars: 5, count: rating.stars_5 ?? 0 },
    { stars: 4, count: rating.stars_4 ?? 0 },
    { stars: 3, count: rating.stars_3 ?? 0 },
    { stars: 2, count: rating.stars_2 ?? 0 },
    { stars: 1, count: rating.stars_1 ?? 0 },
  ];

  const maxCount = Math.max(...histogram.map((h) => h.count), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{rating.app_name || rating.app_store_id}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{rating.store.toUpperCase()}</Badge>
              <Badge variant="secondary" className="text-[10px]">{rating.platform}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold">
                {rating.score != null ? rating.score.toFixed(1) : "--"}
              </span>
              {rating.score_change != null && rating.score_change !== 0 && (
                <ScoreChange change={rating.score_change} />
              )}
            </div>
            <StarDisplay score={rating.score ?? 0} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {histogram.map((h) => (
            <div key={h.stars} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-3 text-right">{h.stars}</span>
              <svg className="h-3 w-3 text-warning shrink-0" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 0.5L7.4 3.6L10.8 4L8.3 6.3L8.9 9.7L6 8.1L3.1 9.7L3.7 6.3L1.2 4L4.6 3.6Z" />
              </svg>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-warning/70 rounded-full transition-all"
                  style={{ width: `${(h.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                {h.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {(rating.ratings_count ?? 0).toLocaleString()} ratings
          </span>
          {rating.count_change != null && rating.count_change !== 0 && (
            <span className={`text-xs font-mono ${rating.count_change > 0 ? "text-success" : "text-destructive"}`}>
              {rating.count_change > 0 ? "+" : ""}{rating.count_change.toLocaleString()} new
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(rating.checked_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function StarDisplay({ score }: { score: number }) {
  const fullStars = Math.floor(score);
  const hasHalf = score - fullStars >= 0.25 && score - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: fullStars }).map((_, i) => (
        <svg key={`f${i}`} className="h-3 w-3 text-warning" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 0.5L7.4 3.6L10.8 4L8.3 6.3L8.9 9.7L6 8.1L3.1 9.7L3.7 6.3L1.2 4L4.6 3.6Z" />
        </svg>
      ))}
      {hasHalf && (
        <svg className="h-3 w-3 text-warning" viewBox="0 0 12 12">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d="M6 0.5L7.4 3.6L10.8 4L8.3 6.3L8.9 9.7L6 8.1L3.1 9.7L3.7 6.3L1.2 4L4.6 3.6Z" fill="url(#half)" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      )}
      {Array.from({ length: Math.max(0, emptyStars) }).map((_, i) => (
        <svg key={`e${i}`} className="h-3 w-3 text-muted-foreground/30" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 0.5L7.4 3.6L10.8 4L8.3 6.3L8.9 9.7L6 8.1L3.1 9.7L3.7 6.3L1.2 4L4.6 3.6Z" />
        </svg>
      ))}
    </div>
  );
}

function ScoreChange({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="text-xs text-success font-mono">
        +{change.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="text-xs text-destructive font-mono">
      {change.toFixed(2)}
    </span>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
