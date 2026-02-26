import React, { useState, useEffect, useRef } from "react";
import { api, type Ranking, type Stats, type HistoryPoint, type App, type KeywordApp, type CheckStatus } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { SkeletonTable, Skeleton } from "../components/ui/skeleton";
import { RankChange } from "../components/shared";
import { formatRelativeTime } from "../lib/utils";

type SortField = "rank" | "keyword" | "store" | "change" | "checked";

export function RankingsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [allApps, setAllApps] = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStore, setFilterStore] = useState("");
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
  const [checkStatus, setCheckStatus] = useState<CheckStatus | null>(null);
  const [showAddKeyword, setShowAddKeyword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkRunning = checkStatus?.running ?? false;

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedAppId) {
      loadRankings();
    }
  }, [selectedAppId, filterStore, sortField, sortDesc]);

  async function loadInitial() {
    setLoading(true);
    setError(null);
    try {
      const [appsData, allAppsData, statsData] = await Promise.all([
        api.getApps({ isOwn: true }),
        api.getApps(),
        api.getStats(),
      ]);
      setApps(appsData);
      setAllApps(allAppsData);
      setStats(statsData);
      if (appsData.length > 0 && !selectedAppId) {
        setSelectedAppId(appsData[0].app_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load apps");
    } finally {
      setLoading(false);
    }
  }

  async function loadRankings() {
    if (!selectedAppId) return;
    setLoadingRankings(true);
    setError(null);
    try {
      const data = await api.getRankings({
        appId: selectedAppId,
        store: filterStore || undefined,
        keyword: filterKeyword || undefined,
        sort: sortField,
        desc: sortDesc,
      });
      setRankings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rankings");
    } finally {
      setLoadingRankings(false);
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.getCheckStatus();
        setCheckStatus(status);
        if (!status.running) {
          stopPolling();
          loadRankings();
          api.getStats().then(setStats);
        }
      } catch {
        // ignore poll errors
      }
    }, 1500);
  }

  // Check if a run is already in progress on mount
  useEffect(() => {
    api.getCheckStatus().then((status) => {
      setCheckStatus(status);
      if (status.running) startPolling();
    }).catch(() => {});
  }, []);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleRunCheck(force?: boolean) {
    try {
      setError(null);
      await api.runCheck({ force });
      const status = await api.getCheckStatus();
      setCheckStatus(status);
      startPolling();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
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
      const newApp = await api.createApp({
        appId: app.appId,
        platform: ranking?.platform ?? "iphone",
        name: app.title,
        developer: app.developer,
        isOwn,
        trackKeywords: isOwn,
        trackRatings: isOwn,
        trackReviews: isOwn,
      });
      // Auto-link competitor to the currently selected own app
      if (!isOwn && selectedApp) {
        await api.linkCompetitor(selectedApp.id, newApp.id);
      }
      const [appsData, allAppsData] = await Promise.all([
        api.getApps({ isOwn: true }),
        api.getApps(),
      ]);
      setApps(appsData);
      setAllApps(allAppsData);
    } catch {
      // may already exist
    } finally {
      setTrackingAppId(null);
    }
  }

  async function handleDeleteKeyword(id: number) {
    try {
      await api.deleteKeyword(id);
      setDeleteConfirm(null);
      loadRankings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete keyword");
    }
  }

  function handleKeywordSearch() {
    loadRankings();
  }

  const selectedApp = apps.find((a) => a.app_id === selectedAppId);
  const uniqueStores = [...new Set(rankings.map((r) => r.store))].sort();

  // Computed stats
  const ranked = rankings.filter((r) => r.current_rank != null);
  const top10 = ranked.filter((r) => r.current_rank! <= 10);
  const improved = rankings.filter((r) => r.rank_change != null && r.rank_change > 0);
  const dropped = rankings.filter((r) => r.rank_change != null && r.rank_change < 0);

  const avgRank = ranked.length > 0
    ? ranked.reduce((sum, r) => sum + r.current_rank!, 0) / ranked.length
    : null;
  const avgImprovement = improved.length > 0
    ? improved.reduce((sum, r) => sum + r.rank_change!, 0) / improved.length
    : null;
  const avgDrop = dropped.length > 0
    ? dropped.reduce((sum, r) => sum + r.rank_change!, 0) / dropped.length
    : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <SkeletonTable rows={8} cols={5} />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div
            className="mx-auto h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
            style={{
              background: "linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(45,212,191,0.12) 100%)",
              border: "1px solid rgba(13,148,136,0.15)",
            }}
          >
            <svg className="h-7 w-7 text-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 14V9M6 14V6M10 14V4M14 14V2" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold mb-2">No apps yet</h3>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Add your first app to start tracking keyword rankings across stores.
          </p>
          <a href="#/apps">
            <Button className="px-6">Add Your First App</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Select
            value={selectedAppId}
            onChange={(e) => {
              setSelectedAppId(e.target.value);
              setExpandedKeyword(null);
              setFilterStore("");
              setFilterKeyword("");
            }}
            options={apps.map((a) => ({ value: a.app_id, label: a.name || a.app_id }))}
            className="w-72 text-base font-semibold h-10"
          />
          {selectedApp && (
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              {selectedApp.platform}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {stats?.lastCheck && !checkRunning && (
            <span className="text-xs text-muted-foreground font-mono">
              {formatRelativeTime(stats.lastCheck)}
            </span>
          )}
          {checkRunning && checkStatus?.progress && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: checkStatus.progress.total > 0
                      ? `${Math.round((checkStatus.progress.completed / checkStatus.progress.total) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                {checkStatus.progress.phase === "keywords" && "Keywords"}
                {checkStatus.progress.phase === "ratings" && "Ratings"}
                {" "}{checkStatus.progress.completed}/{checkStatus.progress.total}
              </span>
            </div>
          )}
          <Button
            onClick={() => handleRunCheck()}
            disabled={checkRunning}
            size="sm"
            style={!checkRunning ? { boxShadow: "0 0 16px rgba(13, 148, 136, 0.2)" } : undefined}
          >
            {checkRunning ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin mr-1.5" />
                Checking...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 8a6 6 0 1 1 1.76 4.24" />
                  <path d="M2 12V8h4" />
                </svg>
                Run Check
              </>
            )}
          </Button>
          {!checkRunning && (
            <Button
              onClick={() => handleRunCheck(true)}
              variant="ghost"
              size="sm"
              title="Force re-check all keywords, even recently checked ones"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 8a6 6 0 1 1 1.76 4.24" />
                <path d="M2 12V8h4" />
              </svg>
              Force
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Tracked Keywords"
          value={rankings.length}
          sub={avgRank != null ? `avg rank #${avgRank.toFixed(1)}` : "no data"}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 13h12M4 9h2v4H4zM7 6h2v7H7zM10 3h2v10h-2z" />
            </svg>
          }
          accent="primary"
        />
        <StatCard
          label="Top 10"
          value={top10.length}
          sub={ranked.length > 0 ? `${((top10.length / ranked.length) * 100).toFixed(0)}% of ranked` : "no data"}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2l2 4 4.5.7-3.3 3.1.8 4.5L8 12.2 3.9 14.3l.8-4.5L1.5 6.7 6 6z" />
            </svg>
          }
          accent="success"
        />
        <StatCard
          label="Improved"
          value={improved.length}
          sub={avgImprovement != null ? `avg +${avgImprovement.toFixed(1)} positions` : "no changes"}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 12V4M5 7l3-3 3 3" />
            </svg>
          }
          accent="success"
        />
        <StatCard
          label="Dropped"
          value={dropped.length}
          sub={avgDrop != null ? `avg ${avgDrop.toFixed(1)} positions` : "no changes"}
          icon={
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 4v8M5 9l3 3 3-3" />
            </svg>
          }
          accent="destructive"
        />
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          placeholder="All Stores"
          options={uniqueStores.map((s) => ({ value: s, label: s.toUpperCase() }))}
          className="w-32"
        />
        <div className="flex gap-2">
          <Input
            placeholder="Filter keywords..."
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleKeywordSearch()}
            className="w-52"
          />
          <Button variant="outline" size="sm" onClick={handleKeywordSearch}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M14 14l-4-4" />
            </svg>
          </Button>
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setShowAddKeyword(true)}>
          <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Keyword
        </Button>
      </div>

      {/* Rankings table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loadingRankings ? (
            <div className="p-6">
              <SkeletonTable rows={10} cols={5} />
            </div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div
                className="mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--color-muted) 0%, var(--color-border) 100%)",
                }}
              >
                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 14V9M6 14V6M10 14V4M14 14V2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No rankings yet</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Add keywords and run a check to see rankings for {selectedApp?.name || "this app"}.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setShowAddKeyword(true)}>Add Keyword</Button>
                <Button onClick={() => handleRunCheck()} disabled={checkRunning}>Run Check</Button>
              </div>
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
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((r) => {
                  const trackedAppIds = new Set(allApps.map((a) => a.app_id));
                  return (
                  <React.Fragment key={r.keyword_id}>
                    <TableRow className={expandedKeyword === r.keyword_id ? "bg-muted/30 border-b-0" : ""}>
                      <TableCell className="font-medium">
                        <button
                          className="text-left hover:text-primary transition-colors hover:underline underline-offset-2"
                          onClick={() => toggleExpanded(r.keyword_id, "topapps")}
                          title="View top apps for this keyword"
                        >
                          {r.keyword}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{r.store.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.current_rank != null ? (
                          <RankPill rank={r.current_rank} />
                        ) : (
                          <span className="text-muted-foreground font-mono text-xs">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <RankChange change={r.rank_change} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {r.checked_at ? formatRelativeTime(r.checked_at) : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(r.keyword_id, "history")}
                            className={`text-xs h-7 px-2 ${expandedKeyword === r.keyword_id && expandedTab === "history" ? "text-primary bg-primary/10" : ""}`}
                          >
                            <svg className="h-3 w-3 mr-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <path d="M2 12l4-4 3 2 5-6" />
                            </svg>
                            History
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(r.keyword_id, "topapps")}
                            className={`text-xs h-7 px-2 ${expandedKeyword === r.keyword_id && expandedTab === "topapps" ? "text-primary bg-primary/10" : ""}`}
                          >
                            <svg className="h-3 w-3 mr-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                              <rect x="2" y="2" width="12" height="12" rx="3" />
                              <path d="M6 6h4M6 8h4M6 10h2" />
                            </svg>
                            Apps
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteConfirm(r.keyword_id)}
                            title="Delete keyword"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M4 4l8 8M12 4l-8 8" />
                            </svg>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedKeyword === r.keyword_id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="bg-muted/20 p-5 border-t-0">
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

      {/* Add Keyword Dialog */}
      <AddKeywordDialog
        open={showAddKeyword}
        onClose={() => setShowAddKeyword(false)}
        onAdded={() => {
          setShowAddKeyword(false);
          loadRankings();
        }}
        apps={apps}
        defaultAppId={selectedAppId}
      />

      {/* Delete Keyword Confirmation */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Keyword</DialogTitle>
            <DialogDescription>
              This will remove the keyword and all its ranking history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm !== null && handleDeleteKeyword(deleteConfirm)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Stat Card ============

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent: "primary" | "success" | "destructive";
}) {
  const accentColors = {
    primary: {
      iconBg: "rgba(13,148,136,0.1)",
      iconBorder: "rgba(13,148,136,0.15)",
      iconColor: "var(--color-primary)",
      valueColor: "",
      barColor: "var(--color-primary)",
    },
    success: {
      iconBg: "rgba(5,150,105,0.1)",
      iconBorder: "rgba(5,150,105,0.15)",
      iconColor: "var(--color-success)",
      valueColor: "text-success",
      barColor: "var(--color-success)",
    },
    destructive: {
      iconBg: "rgba(239,68,68,0.1)",
      iconBorder: "rgba(239,68,68,0.12)",
      iconColor: "var(--color-destructive)",
      valueColor: "text-destructive",
      barColor: "var(--color-destructive)",
    },
  };

  const colors = accentColors[accent];

  return (
    <Card className="relative overflow-hidden">
      {/* Subtle accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: colors.barColor, opacity: 0.5 }}
      />
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
            style={{
              background: colors.iconBg,
              border: `1px solid ${colors.iconBorder}`,
              color: colors.iconColor,
            }}
          >
            {icon}
          </div>
        </div>
        <p className={`text-3xl font-bold font-mono tracking-tight leading-none ${colors.valueColor}`}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ============ Rank Pill ============

function RankPill({ rank }: { rank: number }) {
  let bg: string;
  let text: string;
  if (rank <= 3) {
    bg = "rgba(5,150,105,0.15)";
    text = "text-success";
  } else if (rank <= 10) {
    bg = "rgba(5,150,105,0.08)";
    text = "text-success";
  } else if (rank <= 50) {
    bg = "rgba(217,119,6,0.08)";
    text = "text-warning";
  } else {
    bg = "transparent";
    text = "text-foreground";
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 font-mono font-bold text-sm ${text}`}
      style={{ background: bg }}
    >
      #{rank}
    </span>
  );
}

// ============ History Chart ============

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
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No history data available for "{keyword}".</p>
    );
  }

  const ranks = data.filter((d) => d.rank != null).map((d) => d.rank!);
  const maxRank = Math.max(...ranks);
  const minRank = Math.min(...ranks);
  const range = maxRank - minRank || 1;

  // Use large pixel-based viewBox so strokes/circles render crisply
  const W = 600;
  const H = 180;
  const pad = { top: 20, right: 20, bottom: 32, left: 20 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const reversed = [...data].reverse();
  const points = reversed
    .map((d, i) => {
      if (d.rank == null) return null;
      const x = pad.left + (i / Math.max(reversed.length - 1, 1)) * plotW;
      // rank 1 (best) at top, higher ranks at bottom
      const y = pad.top + ((d.rank - minRank) / range) * plotH;
      return { x, y, rank: d.rank, date: d.checked_at };
    })
    .filter(Boolean) as Array<{ x: number; y: number; rank: number; date: string }>;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = pathD + ` L ${points[points.length - 1].x} ${H - pad.bottom} L ${points[0].x} ${H - pad.bottom} Z`;

  // data comes newest-first, so ranks[0] is latest, ranks[last] is oldest
  const latestRank = ranks[0];
  const oldestRank = ranks[ranks.length - 1];
  const trendDiff = oldestRank - latestRank;

  // Y-axis labels: show min (top) and max (bottom) plus a midpoint
  const midRank = Math.round((minRank + maxRank) / 2);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-sm font-medium">
          Rank history — <span className="text-primary">"{keyword}"</span>
        </p>
        <Badge variant="outline" className="text-[10px] font-mono">{data.length} points</Badge>
      </div>
      <div className="flex items-start gap-5">
        <div
          className="flex-1 rounded-lg overflow-hidden"
          style={{ background: "var(--color-muted)", border: "1px solid var(--color-border)" }}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1={pad.left}
                y1={pad.top + pct * plotH}
                x2={W - pad.right}
                y2={pad.top + pct * plotH}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeWidth="1"
                strokeDasharray={pct === 0 || pct === 1 ? "none" : "4 4"}
              />
            ))}
            {/* Y-axis labels */}
            <text x={pad.left - 6} y={pad.top + 4} fill="currentColor" opacity="0.35" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono, monospace">
              #{minRank}
            </text>
            {minRank !== midRank && maxRank !== midRank && (
              <text x={pad.left - 6} y={pad.top + plotH * 0.5 + 4} fill="currentColor" opacity="0.35" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono, monospace">
                #{midRank}
              </text>
            )}
            <text x={pad.left - 6} y={pad.top + plotH + 4} fill="currentColor" opacity="0.35" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono, monospace">
              #{maxRank}
            </text>
            {/* X-axis date labels */}
            {points.length > 0 && (() => {
              // Show ~5 evenly spaced labels, always include first and last
              const count = Math.min(points.length, 5);
              const indices: number[] = [];
              for (let i = 0; i < count; i++) {
                indices.push(Math.round((i / (count - 1)) * (points.length - 1)));
              }
              // Deduplicate in case of rounding
              const unique = [...new Set(indices)];
              return unique.map((idx) => {
                const p = points[idx];
                const d = new Date(p.date);
                const label = `${d.getDate()}/${d.getMonth() + 1}`;
                return (
                  <text
                    key={idx}
                    x={p.x}
                    y={H - pad.bottom + 16}
                    fill="currentColor"
                    opacity="0.35"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {label}
                  </text>
                );
              });
            })()}
            {/* Area fill */}
            <path d={areaD} fill="url(#chartGrad)" opacity="0.25" />
            {/* Line */}
            <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Data point dots */}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--color-primary)" opacity={i === points.length - 1 ? 1 : 0.4} />
            ))}
            {/* Latest point highlight */}
            {points.length > 0 && (
              <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="6" fill="var(--color-primary)" opacity="0.15" />
            )}
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="shrink-0 space-y-2 w-28">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best</p>
            <p className="text-base font-bold font-mono text-success">#{minRank}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Worst</p>
            <p className="text-base font-bold font-mono">#{maxRank}</p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Trend</p>
            <p className={`text-base font-bold font-mono ${trendDiff > 0 ? "text-success" : trendDiff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {trendDiff > 0 ? `+${trendDiff}` : trendDiff < 0 ? `${trendDiff}` : "stable"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Top Apps Panel ============

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
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">No apps found for "{keyword}".</p>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <p className="text-sm font-medium">
          Top apps — <span className="text-primary">"{keyword}"</span>
        </p>
        <Badge variant="outline" className="text-[10px] font-mono">{apps.length} results</Badge>
      </div>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {apps.map((app) => {
          const isTracked = trackedAppIds.has(app.appId);
          return (
            <div
              key={app.appId}
              className="flex items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-accent/50 transition-colors group"
            >
              <RankPill rank={app.rank} />
              {app.icon && (
                <img src={app.icon} alt="" className="h-9 w-9 rounded-xl shrink-0 shadow-sm" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{app.title}</p>
                <p className="text-xs text-muted-foreground truncate">{app.developer}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {app.score > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {app.score.toFixed(1)}
                      <svg className="inline h-2.5 w-2.5 ml-0.5 -mt-0.5 text-warning" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 2l2 4 4.5.7-3.3 3.1.8 4.5L8 12.2 3.9 14.3l.8-4.5L1.5 6.7 6 6z" />
                      </svg>
                    </span>
                  )}
                  {app.free && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Free</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                {isTracked ? (
                  <Badge variant="outline" className="text-[10px]">Tracked</Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => onTrack(app, false)}
                    variant="outline"
                    className="h-7 text-xs px-2"
                    disabled={trackingAppId === app.appId}
                  >
                    {trackingAppId === app.appId ? "..." : "+ Competitor"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Add Keyword Dialog ============

function AddKeywordDialog({
  open,
  onClose,
  onAdded,
  apps,
  defaultAppId,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  apps: App[];
  defaultAppId: string;
}) {
  const [appId, setAppId] = useState(defaultAppId);
  const [keyword, setKeyword] = useState("");
  const [store, setStore] = useState("us");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAppId(defaultAppId);
    }
  }, [open, defaultAppId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appId || !keyword.trim() || !store) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.addKeyword({ appId, keyword: keyword.trim().toLowerCase(), store });
      setKeyword("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add keyword");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setKeyword("");
    setError(null);
    onClose();
  }

  const COMMON_STORES = [
    { value: "us", label: "US" },
    { value: "gb", label: "GB" },
    { value: "ca", label: "CA" },
    { value: "au", label: "AU" },
    { value: "de", label: "DE" },
    { value: "fr", label: "FR" },
    { value: "it", label: "IT" },
    { value: "es", label: "ES" },
    { value: "nl", label: "NL" },
    { value: "be", label: "BE" },
    { value: "jp", label: "JP" },
    { value: "kr", label: "KR" },
    { value: "br", label: "BR" },
    { value: "in", label: "IN" },
  ];

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Keyword</DialogTitle>
          <DialogDescription>Track a keyword ranking for an app in a specific store.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">App</label>
            <Select
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              options={apps.map((a) => ({ value: a.app_id, label: a.name || a.app_id }))}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Keyword</label>
            <Input
              placeholder="e.g. weather app"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Store</label>
            <Select
              value={store}
              onChange={(e) => setStore(e.target.value)}
              options={COMMON_STORES}
              className="w-full"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || !keyword.trim()}>
              {submitting ? "Adding..." : "Add Keyword"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
