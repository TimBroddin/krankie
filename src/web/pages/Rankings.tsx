import React, { useState, useEffect } from "react";
import { api, type Ranking, type HistoryPoint, type App, type KeywordApp } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonTable, Skeleton } from "../components/ui/skeleton";

type SortField = "rank" | "keyword" | "store" | "app" | "change" | "checked";

export function RankingsPage() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortDesc, setSortDesc] = useState(false);
  const [expandedKeyword, setExpandedKeyword] = useState<number | null>(null);
  const [expandedTab, setExpandedTab] = useState<"history" | "topapps">("history");
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [topApps, setTopApps] = useState<KeywordApp[]>([]);
  const [topAppsLoading, setTopAppsLoading] = useState(false);
  const [trackingAppId, setTrackingAppId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [filterApp, filterStore, filterPlatform, sortField, sortDesc]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [rankingsData, appsData] = await Promise.all([
        api.getRankings({
          appId: filterApp || undefined,
          store: filterStore || undefined,
          platform: filterPlatform || undefined,
          keyword: filterKeyword || undefined,
          sort: sortField,
          desc: sortDesc,
        }),
        api.getApps(),
      ]);
      setRankings(rankingsData);
      setApps(appsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rankings");
    } finally {
      setLoading(false);
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(false);
    }
  }

  async function toggleExpanded(keywordId: number, tab: "history" | "topapps") {
    if (expandedKeyword === keywordId && expandedTab === tab) {
      setExpandedKeyword(null);
      setHistoryData([]);
      setTopApps([]);
      return;
    }
    setExpandedKeyword(keywordId);
    setExpandedTab(tab);

    if (tab === "history") {
      setHistoryLoading(true);
      try {
        const data = await api.getRankingHistory(keywordId, 14);
        setHistoryData(data);
      } catch {
        setHistoryData([]);
      } finally {
        setHistoryLoading(false);
      }
    } else {
      const ranking = rankings.find((r) => r.keyword_id === keywordId);
      if (!ranking) return;
      setTopAppsLoading(true);
      try {
        const data = await api.getKeywordApps({
          keyword: ranking.keyword,
          store: ranking.store,
          platform: ranking.platform,
        });
        setTopApps(data);
      } catch {
        setTopApps([]);
      } finally {
        setTopAppsLoading(false);
      }
    }
  }

  async function handleTrackApp(app: KeywordApp, isOwn: boolean) {
    const ranking = rankings.find((r) => r.keyword_id === expandedKeyword);
    setTrackingAppId(app.appId);
    try {
      await api.createApp({
        appId: app.appId,
        platform: ranking?.platform ?? "iphone",
        name: app.title,
        developer: app.developer,
        isOwn,
        trackKeywords: isOwn,
        trackRatings: isOwn,
        trackReviews: isOwn,
      });
      // Refresh apps list
      const appsData = await api.getApps();
      setApps(appsData);
    } catch {
      // may already exist
    } finally {
      setTrackingAppId(null);
    }
  }

  function handleKeywordSearch() {
    loadData();
  }

  const uniqueStores = [...new Set(rankings.map((r) => r.store))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Rankings</h2>
          <p className="text-muted-foreground">Current keyword rankings across all tracked apps</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
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
        <div className="flex gap-2">
          <Input
            placeholder="Filter keywords..."
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleKeywordSearch()}
            className="w-48"
          />
          <Button variant="outline" size="sm" onClick={handleKeywordSearch}>
            Filter
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <SkeletonTable rows={10} cols={6} />
          ) : rankings.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 14V9M6 14V6M10 14V4M14 14V2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No rankings yet</h3>
              <p className="text-sm text-muted-foreground">
                Run a check to fetch the latest rankings for your tracked keywords.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    sortable
                    sorted={sortField === "keyword" ? (sortDesc ? "desc" : "asc") : false}
                    onSort={() => handleSort("keyword")}
                  >
                    Keyword
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "app" ? (sortDesc ? "desc" : "asc") : false}
                    onSort={() => handleSort("app")}
                  >
                    App
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "store" ? (sortDesc ? "desc" : "asc") : false}
                    onSort={() => handleSort("store")}
                  >
                    Store
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "rank" ? (sortDesc ? "desc" : "asc") : false}
                    onSort={() => handleSort("rank")}
                    className="text-right"
                  >
                    Rank
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "change" ? (sortDesc ? "desc" : "asc") : false}
                    onSort={() => handleSort("change")}
                    className="text-right"
                  >
                    Change
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "checked" ? (sortDesc ? "desc" : "asc") : false}
                    onSort={() => handleSort("checked")}
                  >
                    Checked
                  </TableHead>
                  <TableHead className="w-[160px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((r) => {
                  const trackedAppIds = new Set(apps.map((a) => a.app_id));
                  return (
                  <React.Fragment key={r.keyword_id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <button
                          className="text-left hover:text-primary transition-colors hover:underline underline-offset-2"
                          onClick={() => toggleExpanded(r.keyword_id, "topapps")}
                          title="View top apps for this keyword"
                        >
                          {r.keyword}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.app_name || r.app_store_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.store.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {r.current_rank != null ? (
                          <span className={r.current_rank <= 10 ? "text-success" : r.current_rank <= 50 ? "text-warning" : ""}>
                            #{r.current_rank}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <RankChange change={r.rank_change} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.checked_at ? formatRelativeTime(r.checked_at) : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(r.keyword_id, "history")}
                            className={`text-xs ${expandedKeyword === r.keyword_id && expandedTab === "history" ? "text-primary" : ""}`}
                          >
                            History
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(r.keyword_id, "topapps")}
                            className={`text-xs ${expandedKeyword === r.keyword_id && expandedTab === "topapps" ? "text-primary" : ""}`}
                          >
                            Top Apps
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedKeyword === r.keyword_id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-4">
                          {expandedTab === "history" ? (
                            <HistoryChart
                              data={historyData}
                              loading={historyLoading}
                              keyword={r.keyword}
                            />
                          ) : (
                            <TopAppsPanel
                              apps={topApps}
                              loading={topAppsLoading}
                              keyword={r.keyword}
                              trackedAppIds={trackedAppIds}
                              trackingAppId={trackingAppId}
                              onTrack={handleTrackApp}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryChart({
  data,
  loading,
  keyword,
}: {
  data: HistoryPoint[];
  loading: boolean;
  keyword: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No history data available for "{keyword}".</p>
    );
  }

  const ranks = data.filter((d) => d.rank != null).map((d) => d.rank!);
  const maxRank = Math.max(...ranks, 10);
  const minRank = Math.min(...ranks, 1);
  const range = maxRank - minRank || 1;
  const chartHeight = 80;
  const chartWidth = 100;

  const reversed = [...data].reverse();
  const points = reversed
    .map((d, i) => {
      if (d.rank == null) return null;
      const x = (i / Math.max(reversed.length - 1, 1)) * chartWidth;
      const y = ((d.rank - minRank) / range) * chartHeight;
      return { x, y, rank: d.rank, date: d.checked_at };
    })
    .filter(Boolean) as Array<{ x: number; y: number; rank: number; date: string }>;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <p className="text-sm font-medium mb-2">
        Rank history for "{keyword}" (last 14 days)
      </p>
      <div className="flex items-start gap-4">
        <svg
          viewBox={`-8 -8 ${chartWidth + 16} ${chartHeight + 16}`}
          className="w-full max-w-md h-24"
          preserveAspectRatio="none"
        >
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2"
              className="fill-primary"
            />
          ))}
          <text x="0" y="-2" className="fill-muted-foreground" fontSize="6" textAnchor="start">
            #{minRank}
          </text>
          <text x="0" y={chartHeight + 6} className="fill-muted-foreground" fontSize="6" textAnchor="start">
            #{maxRank}
          </text>
        </svg>
        <div className="text-xs text-muted-foreground space-y-1 shrink-0">
          <p>Data points: {data.length}</p>
          <p>Best: #{minRank}</p>
          <p>Worst: #{maxRank}</p>
          {ranks.length > 1 && (
            <p>
              Trend:{" "}
              {ranks[0] < ranks[ranks.length - 1] ? (
                <span className="text-destructive">dropping</span>
              ) : ranks[0] > ranks[ranks.length - 1] ? (
                <span className="text-success">improving</span>
              ) : (
                <span>stable</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TopAppsPanel({
  apps,
  loading,
  keyword,
  trackedAppIds,
  trackingAppId,
  onTrack,
}: {
  apps: KeywordApp[];
  loading: boolean;
  keyword: string;
  trackedAppIds: Set<string>;
  trackingAppId: string | null;
  onTrack: (app: KeywordApp, isOwn: boolean) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No apps found for "{keyword}".</p>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium mb-3">
        Top apps ranking for "{keyword}" ({apps.length} results)
      </p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {apps.map((app) => {
          const isTracked = trackedAppIds.has(app.appId);
          return (
            <div
              key={app.appId}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold font-mono shrink-0">
                #{app.rank}
              </span>
              {app.icon && (
                <img src={app.icon} alt="" className="h-9 w-9 rounded-lg shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{app.title}</p>
                <p className="text-xs text-muted-foreground truncate">{app.developer}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {app.score > 0 && (
                    <span className="text-xs text-muted-foreground">{app.score.toFixed(1)} stars</span>
                  )}
                  {app.free && (
                    <Badge variant="secondary" className="text-[10px]">Free</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {isTracked ? (
                  <Badge variant="outline">Tracked</Badge>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onTrack(app, false)}
                      variant="outline"
                      disabled={trackingAppId === app.appId}
                    >
                      {trackingAppId === app.appId ? "..." : "Watch"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onTrack(app, true)}
                      disabled={trackingAppId === app.appId}
                    >
                      {trackingAppId === app.appId ? "..." : "Track"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankChange({ change }: { change: number | null }) {
  if (change == null) return <span className="text-muted-foreground">--</span>;
  if (change > 0) {
    return (
      <Badge variant="success" className="font-mono">
        <svg className="h-3 w-3 mr-0.5" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 2L10 8H2L6 2Z" />
        </svg>
        +{change}
      </Badge>
    );
  }
  if (change < 0) {
    return (
      <Badge variant="destructive" className="font-mono">
        <svg className="h-3 w-3 mr-0.5" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 10L2 4H10L6 10Z" />
        </svg>
        {change}
      </Badge>
    );
  }
  return <span className="text-muted-foreground font-mono">0</span>;
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
