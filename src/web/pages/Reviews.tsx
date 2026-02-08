import React, { useState, useEffect } from "react";
import { api, type Review, type ReviewStats, type App } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { SkeletonCard, Skeleton } from "../components/ui/skeleton";

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterScore, setFilterScore] = useState("");
  const [limit, setLimit] = useState(50);
  const [expandedReview, setExpandedReview] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [filterApp, filterStore, filterPlatform, filterScore, limit]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [reviewsData, statsData, appsData] = await Promise.all([
        api.getReviews({
          appId: filterApp || undefined,
          store: filterStore || undefined,
          platform: filterPlatform || undefined,
          minScore: filterScore ? Number(filterScore) : undefined,
          maxScore: filterScore ? Number(filterScore) : undefined,
          limit,
        }),
        api.getReviewStats({
          appId: filterApp || undefined,
          store: filterStore || undefined,
        }),
        api.getApps(),
      ]);
      setReviews(reviewsData);
      setStats(statsData);
      setApps(appsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

  const uniqueStores = [...new Set(reviews.map((r) => r.store))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reviews</h2>
          <p className="text-muted-foreground">App Store reviews and sentiment analysis</p>
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

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : stats ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Total Reviews" value={stats.total.toLocaleString()} />
          <StatsCard title="Average Score" value={stats.averageScore > 0 ? stats.averageScore.toFixed(1) : "--"} />
          <StatsCard title="Recent (30d)" value={stats.recentCount.toLocaleString()} />
          <StatsCard
            title="Recent Avg"
            value={stats.recentAverageScore > 0 ? stats.recentAverageScore.toFixed(1) : "--"}
          />
        </div>
      ) : null}

      {stats && stats.total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DistributionBar distribution={stats.distribution} total={stats.total} />
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
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
        <Select
          value={filterScore}
          onChange={(e) => setFilterScore(e.target.value)}
          placeholder="All Scores"
          options={[
            { value: "5", label: "5 Stars" },
            { value: "4", label: "4 Stars" },
            { value: "3", label: "3 Stars" },
            { value: "2", label: "2 Stars" },
            { value: "1", label: "1 Star" },
          ]}
          className="w-32"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h12v8H5L2 14V3Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No reviews found</h3>
              <p className="text-sm text-muted-foreground">
                Run a check to fetch reviews, or adjust your filters.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              expanded={expandedReview === review.id}
              onToggle={() =>
                setExpandedReview(expandedReview === review.id ? null : review.id)
              }
            />
          ))}

          {reviews.length >= limit && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={() => setLimit((prev) => prev + 50)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DistributionBar({
  distribution,
  total,
}: {
  distribution: Record<number, number>;
  total: number;
}) {
  const colors: Record<number, string> = {
    5: "bg-success",
    4: "bg-success/60",
    3: "bg-warning",
    2: "bg-warning/60",
    1: "bg-destructive",
  };

  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-full overflow-hidden bg-muted">
        {[5, 4, 3, 2, 1].map((score) => {
          const count = distribution[score] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={score}
              className={`${colors[score]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${score} stars: ${count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {[5, 4, 3, 2, 1].map((score) => {
          const count = distribution[score] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={score} className="text-center">
              <span className="block font-medium">{score} star{score !== 1 ? "s" : ""}</span>
              <span>{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  expanded,
  onToggle,
}: {
  review: Review;
  expanded: boolean;
  onToggle: () => void;
}) {
  const scoreColor =
    review.score >= 4
      ? "text-success"
      : review.score >= 3
        ? "text-warning"
        : "text-destructive";

  return (
    <Card className="transition-colors hover:bg-card/80">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={`h-3.5 w-3.5 ${i < review.score ? "text-warning" : "text-muted-foreground/30"}`}
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <path d="M6 0.5L7.4 3.6L10.8 4L8.3 6.3L8.9 9.7L6 8.1L3.1 9.7L3.7 6.3L1.2 4L4.6 3.6Z" />
                  </svg>
                ))}
              </div>
              {review.title && (
                <span className="font-medium text-sm truncate">{review.title}</span>
              )}
            </div>

            <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>
              {review.text || "No review text."}
            </p>

            {review.text && review.text.length > 120 && (
              <button
                onClick={onToggle}
                className="text-xs text-primary hover:underline mt-1"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {review.author && (
                <span className="text-xs text-muted-foreground">
                  by {review.author}
                </span>
              )}
              <Badge variant="outline" className="text-[10px]">
                {review.store.toUpperCase()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {review.app_name || review.app_store_id}
              </span>
              {review.version && (
                <span className="text-xs text-muted-foreground">
                  v{review.version}
                </span>
              )}
              {review.updated_at && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(review.updated_at)}
                </span>
              )}
            </div>
          </div>

          <span className={`text-lg font-bold shrink-0 ${scoreColor}`}>
            {review.score}/5
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
