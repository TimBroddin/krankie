import React, { useState, useEffect } from "react";
import { api, type App, type SearchResult, type Rating, type Review, type ReviewStats, type Ranking, type CompetitorOverview, type CompetitorRankingEntry } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { SkeletonTable, SkeletonCard, Skeleton } from "../components/ui/skeleton";
import { RankChange, RatingCard, InfoItem } from "../components/shared";
import { formatRelativeTime, formatDate } from "../lib/utils";

type DetailTab = "overview" | "rankings" | "ratings" | "reviews" | "competitors";

interface DetailData {
  details: any | null;
  ratings: Rating[];
  reviews: Review[];
  reviewStats: ReviewStats | null;
  rankings: Ranking[];
  linkedCompetitors: App[];
  allCompetitors: App[];
  competitorOverviews: CompetitorOverview[];
  loading: boolean;
  error: string | null;
}

const EMPTY_DETAIL: DetailData = {
  details: null, ratings: [], reviews: [], reviewStats: null, rankings: [],
  linkedCompetitors: [], allCompetitors: [], competitorOverviews: [],
  loading: false, error: null,
};

export function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masterAppId, setMasterAppId] = useState<string>("");
  const [linkedCompetitorIds, setLinkedCompetitorIds] = useState<Set<number>>(new Set());
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPlatform, setSearchPlatform] = useState("iphone");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Detail view
  const [selectedApp, setSelectedApp] = useState<App | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [detailData, setDetailData] = useState<DetailData>(EMPTY_DETAIL);

  // Competitor comparison state
  const [compareApp, setCompareApp] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<CompetitorRankingEntry[]>([]);
  const [ownRankings, setOwnRankings] = useState<Ranking[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);

  // Reviews expand
  const [expandedReview, setExpandedReview] = useState<number | null>(null);
  const [reviewFilterScore, setReviewFilterScore] = useState("");

  useEffect(() => { loadApps(); }, []);

  async function loadApps() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getApps();
      setApps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load apps");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const results = await api.search(searchQuery, undefined, searchPlatform);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddApp(result: SearchResult, isOwn: boolean) {
    try {
      const newApp = await api.createApp({
        appId: result.appId,
        platform: searchPlatform,
        name: result.title,
        developer: result.developer,
        isOwn,
        trackKeywords: isOwn,
        trackRatings: isOwn,
        trackReviews: isOwn,
      });
      // Auto-link competitor to all own apps
      if (!isOwn) {
        const ownApps = apps.filter((a) => a.is_own);
        for (const own of ownApps) {
          await api.linkCompetitor(own.id, newApp.id);
        }
      }
      loadApps();
      setSearchResults((prev) => prev.filter((r) => r.appId !== result.appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app");
    }
  }

  async function handleSetOwn(appId: string, isOwn: boolean) {
    try {
      const updates: any = { isOwn };
      if (isOwn) {
        updates.trackKeywords = true;
        updates.trackRatings = true;
        updates.trackReviews = true;
      }
      await api.updateApp(appId, updates);
      setApps((prev) => prev.map((a) =>
        a.app_id === appId ? {
          ...a,
          is_own: isOwn ? 1 : 0,
          ...(isOwn ? { track_keywords: 1, track_ratings: 1, track_reviews: 1 } : {}),
        } : a
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDelete(appId: string) {
    try {
      await api.deleteApp(appId);
      setApps((prev) => prev.filter((a) => a.app_id !== appId));
      setDeleteConfirm(null);
      if (selectedApp?.app_id === appId) setSelectedApp(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete app");
    }
  }

  async function handleSelectApp(app: App) {
    setSelectedApp(app);
    setDetailTab("overview");
    setDetailData({ ...EMPTY_DETAIL, loading: true });
    setCompareApp(null);
    setCompareData([]);
    setOwnRankings([]);
    setExpandedReview(null);
    setReviewFilterScore("");

    try {
      const promises: Promise<any>[] = [
        api.getAppDetails(app.app_id).catch(() => null),
        api.getRatings({ appId: app.app_id }).catch(() => []),
        api.getReviews({ appId: app.app_id, limit: 50 }).catch(() => []),
        api.getReviewStats({ appId: app.app_id }).catch(() => null),
        api.getRankings({ appId: app.app_id }).catch(() => []),
      ];

      // Fetch competitor data only for own apps
      if (app.is_own) {
        promises.push(
          api.getLinkedCompetitors(app.id).catch(() => []),
          api.getApps({ isOwn: false }).catch(() => []),
          api.getCompetitors(app.app_id).then((d) => d.competitors).catch(() => []),
        );
      }

      const results = await Promise.all(promises);
      setDetailData({
        details: results[0],
        ratings: results[1],
        reviews: results[2],
        reviewStats: results[3],
        rankings: results[4],
        linkedCompetitors: app.is_own ? results[5] : [],
        allCompetitors: app.is_own ? results[6] : [],
        competitorOverviews: app.is_own ? results[7] : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setDetailData({
        ...EMPTY_DETAIL,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load data",
      });
    }
  }

  async function handleCompare(competitorAppId: string) {
    if (!selectedApp) return;
    if (compareApp === competitorAppId) {
      setCompareApp(null);
      setCompareData([]);
      setOwnRankings([]);
      return;
    }
    setCompareApp(competitorAppId);
    setLoadingCompare(true);
    try {
      const [ownData, compData] = await Promise.all([
        api.getRankings({ appId: selectedApp.app_id }),
        api.getCompetitorRankings({ appId: competitorAppId }),
      ]);
      setOwnRankings(ownData);
      setCompareData(compData);
    } catch {
      setCompareData([]);
      setOwnRankings([]);
    } finally {
      setLoadingCompare(false);
    }
  }

  async function handleLink(competitorApp: App) {
    if (!selectedApp) return;
    try {
      await api.linkCompetitor(selectedApp.id, competitorApp.id);
      setDetailData((prev) => ({
        ...prev,
        linkedCompetitors: [...prev.linkedCompetitors, competitorApp],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link competitor");
    }
  }

  async function handleUnlink(competitorApp: App) {
    if (!selectedApp) return;
    try {
      await api.unlinkCompetitor(selectedApp.id, competitorApp.id);
      setDetailData((prev) => ({
        ...prev,
        linkedCompetitors: prev.linkedCompetitors.filter((c) => c.id !== competitorApp.id),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink competitor");
    }
  }

  const trackedAppIds = new Set(apps.map((a) => a.app_id));
  const ownApps = apps.filter((a) => a.is_own);
  const masterApp = ownApps.find((a) => a.app_id === masterAppId) ?? ownApps[0] ?? null;
  const competitorApps = apps.filter((a) => !a.is_own);
  const linkedComps = competitorApps.filter((a) => linkedCompetitorIds.has(a.id));

  // Auto-select first own app
  useEffect(() => {
    if (ownApps.length > 0 && !masterAppId) {
      setMasterAppId(ownApps[0].app_id);
    }
  }, [ownApps.length]);

  // Load linked competitors when master app changes
  useEffect(() => {
    if (masterApp) {
      (async () => {
        setLoadingLinked(true);
        try {
          const linked = await api.getLinkedCompetitors(masterApp.id);
          setLinkedCompetitorIds(new Set(linked.map((c) => c.id)));
        } catch {
          setLinkedCompetitorIds(new Set());
        } finally {
          setLoadingLinked(false);
        }
      })();
    }
  }, [masterApp?.id]);

  async function handleUnlinkFromMaster(competitorApp: App) {
    if (!masterApp) return;
    try {
      await api.unlinkCompetitor(masterApp.id, competitorApp.id);
      setLinkedCompetitorIds((prev) => {
        const next = new Set(prev);
        next.delete(competitorApp.id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink competitor");
    }
  }

  // ============ Detail View ============
  if (selectedApp) {
    const d = detailData.details;
    const tabs: { key: DetailTab; label: string }[] = [
      { key: "overview", label: "Overview" },
      { key: "rankings", label: `Rankings (${detailData.rankings.length})` },
      { key: "ratings", label: `Ratings (${detailData.ratings.length})` },
      { key: "reviews", label: `Reviews (${detailData.reviews.length})` },
    ];
    if (selectedApp.is_own) {
      tabs.push({ key: "competitors", label: `Competitors (${detailData.linkedCompetitors.length})` });
    }

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedApp(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3L5 8l5 5" />
          </svg>
          Back to apps
        </button>

        {/* Header card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              {d?.artworkUrl100 && (
                <img src={d.artworkUrl100} alt="" className="h-16 w-16 rounded-xl shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold">
                  {d?.trackName ?? selectedApp.name ?? selectedApp.app_id}
                  <Badge variant={selectedApp.is_own ? "success" : "outline"} className="ml-2 align-middle">
                    {selectedApp.is_own ? "OWN" : "COMP"}
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {d?.artistName ?? selectedApp.developer ?? "Unknown developer"}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {d?.primaryGenreName && (
                    <Badge variant="secondary" className="text-[10px]">{d.primaryGenreName}</Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">{selectedApp.platform}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{selectedApp.app_id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(d?.trackViewUrl ?? d?.url) && (
                  <a
                    href={d.trackViewUrl ?? d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    App Store
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setDetailTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                detailTab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {detailData.loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : detailData.error ? (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{detailData.error}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {detailTab === "overview" && (
              <OverviewTab details={d} ratings={detailData.ratings} app={selectedApp} />
            )}
            {detailTab === "rankings" && (
              <RankingsTab rankings={detailData.rankings} />
            )}
            {detailTab === "ratings" && (
              <RatingsTab ratings={detailData.ratings} />
            )}
            {detailTab === "reviews" && (
              <ReviewsTab
                reviews={detailData.reviews}
                stats={detailData.reviewStats}
                expandedReview={expandedReview}
                onToggleExpand={(id) => setExpandedReview(expandedReview === id ? null : id)}
                filterScore={reviewFilterScore}
                onFilterScore={setReviewFilterScore}
              />
            )}
            {detailTab === "competitors" && selectedApp.is_own && (
              <CompetitorsTab
                ownApp={selectedApp}
                linkedCompetitors={detailData.linkedCompetitors}
                allCompetitors={detailData.allCompetitors}
                competitorOverviews={detailData.competitorOverviews}
                compareApp={compareApp}
                compareData={compareData}
                ownRankings={ownRankings}
                loadingCompare={loadingCompare}
                onCompare={handleCompare}
                onLink={handleLink}
                onUnlink={handleUnlink}
              />
            )}
          </>
        )}
      </div>
    );
  }

  // ============ Master View ============
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Apps</h2>
        <p className="text-muted-foreground mt-1">Search the App Store, track your apps and competitors</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search App Store</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select
              value={searchPlatform}
              onChange={(e) => setSearchPlatform(e.target.value)}
              options={[
                { value: "iphone", label: "iPhone" },
                { value: "ipad", label: "iPad" },
                { value: "mac", label: "Mac" },
              ]}
              className="w-28 shrink-0"
            />
            <Input
              placeholder="Search by app name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 min-w-0"
            />
            <Button onClick={handleSearch} disabled={searching} className="shrink-0">
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-[400px] overflow-y-auto">
              {searchResults.map((result) => {
                const isTracked = trackedAppIds.has(result.appId);
                return (
                  <div
                    key={result.appId}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
                  >
                    {result.icon && (
                      <img src={result.icon} alt="" className="h-10 w-10 rounded-lg shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.developer}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {result.score > 0 && (
                          <span className="text-xs text-muted-foreground">{result.score.toFixed(1)} stars</span>
                        )}
                        {result.free && <Badge variant="secondary" className="text-[10px]">Free</Badge>}
                      </div>
                    </div>
                    {isTracked ? (
                      <Badge variant="outline">Tracked</Badge>
                    ) : (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => handleAddApp(result, true)}>
                          Add as Own
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAddApp(result, false)}>
                          + Competitor
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Apps section */}
      <Card>
        <CardHeader>
          <CardTitle>My Apps</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable rows={3} cols={4} />
          ) : ownApps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No apps yet. Search above to add your first app.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ownApps.map((app) => (
                <div
                  key={app.app_id}
                  className="rounded-lg border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => handleSelectApp(app)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{app.name || app.app_id}</p>
                      {app.developer && (
                        <p className="text-xs text-muted-foreground truncate">{app.developer}</p>
                      )}
                    </div>
                    <Badge variant="success" className="ml-2 shrink-0">OWN</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">{app.platform}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive text-xs"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(app.app_id); }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competitors section — scoped to selected own app */}
      {ownApps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Competitors</CardTitle>
              <Select
                value={masterApp?.app_id ?? ""}
                onChange={(e) => setMasterAppId(e.target.value)}
                options={ownApps.map((a) => ({ value: a.app_id, label: a.name || a.app_id }))}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loadingLinked ? (
              <SkeletonTable rows={3} cols={4} />
            ) : linkedComps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No competitors linked to {masterApp?.name || "this app"}. Add competitors from Research or Rankings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {linkedComps.map((app) => (
                  <div
                    key={app.app_id}
                    className="rounded-lg border border-border p-4 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => handleSelectApp(app)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{app.name || app.app_id}</p>
                        {app.developer && (
                          <p className="text-xs text-muted-foreground truncate">{app.developer}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{app.platform}</Badge>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground text-xs"
                          onClick={(e) => { e.stopPropagation(); handleUnlinkFromMaster(app); }}
                        >
                          Unlink
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive text-xs"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(app.app_id); }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete App</DialogTitle>
            <DialogDescription>
              This will remove the app and all associated keywords, rankings, ratings, and reviews. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Detail Tabs ============

function OverviewTab({ details: d, ratings, app }: { details: any; ratings: Rating[]; app: App }) {
  return (
    <div className="space-y-5">
      {d?.description && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80 line-clamp-4">{d.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <InfoItem
          label="Rating"
          value={
            d?.averageUserRating != null
              ? `${Number(d.averageUserRating).toFixed(1)} (${(d.userRatingCount ?? 0).toLocaleString()})`
              : "N/A"
          }
        />
        <InfoItem label="Price" value={d?.price === 0 || d?.free ? "Free" : d?.formattedPrice ?? "N/A"} />
        <InfoItem label="Version" value={d?.version ?? "N/A"} />
        <InfoItem
          label="Size"
          value={d?.fileSizeBytes ? `${(Number(d.fileSizeBytes) / 1048576).toFixed(1)} MB` : "N/A"}
        />
        <InfoItem label="Min OS" value={d?.minimumOsVersion ?? "N/A"} />
        <InfoItem label="Content Rating" value={d?.contentAdvisoryRating ?? "N/A"} />
        <InfoItem
          label="Released"
          value={d?.releaseDate ? new Date(d.releaseDate).toLocaleDateString() : "N/A"}
        />
        <InfoItem
          label="Updated"
          value={d?.currentVersionReleaseDate ? new Date(d.currentVersionReleaseDate).toLocaleDateString() : "N/A"}
        />
        <InfoItem label="Bundle ID" value={d?.bundleId ?? "N/A"} />
        {d?.averageUserRatingForCurrentVersion != null && (
          <InfoItem
            label="Current Ver."
            value={`${Number(d.averageUserRatingForCurrentVersion).toFixed(1)} (${(d.userRatingCountForCurrentVersion ?? 0).toLocaleString()})`}
          />
        )}
        {d?.languageCodesISO2A && (
          <InfoItem
            label="Languages"
            value={Array.isArray(d.languageCodesISO2A) ? d.languageCodesISO2A.join(", ") : String(d.languageCodesISO2A)}
          />
        )}
      </div>

      {ratings.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Tracked Ratings</p>
          <div className="space-y-3">
            {ratings.map((r) => (
              <RatingCard key={`${r.app_id}-${r.store}`} rating={r} />
            ))}
          </div>
        </div>
      )}

      {d?.releaseNotes && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Release Notes (v{d.version})</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80 line-clamp-4 whitespace-pre-line">{d.releaseNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RankingsTab({ rankings }: { rankings: Ranking[] }) {
  if (rankings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-6">
            No ranking data. Run a check to fetch rankings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Store</TableHead>
              <TableHead className="text-right">Rank</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead>Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankings.map((r, idx) => (
              <TableRow key={r.keyword_id} className={idx % 2 ? "bg-muted/30" : ""}>
                <TableCell className="font-medium">{r.keyword}</TableCell>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RatingsTab({ ratings }: { ratings: Rating[] }) {
  if (ratings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-6">
            No ratings data. Run a check to fetch ratings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {ratings.map((r) => (
        <FullRatingCard key={`${r.app_id}-${r.store}`} rating={r} />
      ))}
    </div>
  );
}

function FullRatingCard({ rating }: { rating: Rating }) {
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
          <div className="flex items-center gap-2">
            <Badge variant="outline">{rating.store.toUpperCase()}</Badge>
            <Badge variant="secondary" className="text-[10px]">{rating.platform}</Badge>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold">
                {rating.score != null ? Number(rating.score).toFixed(1) : "--"}
              </span>
              {rating.score_change != null && rating.score_change !== 0 && (
                <span className={`text-xs font-mono ${rating.score_change > 0 ? "text-success" : "text-destructive"}`}>
                  {rating.score_change > 0 ? "+" : ""}{rating.score_change.toFixed(2)}
                </span>
              )}
            </div>
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

function ReviewsTab({
  reviews,
  stats,
  expandedReview,
  onToggleExpand,
  filterScore,
  onFilterScore,
}: {
  reviews: Review[];
  stats: ReviewStats | null;
  expandedReview: number | null;
  onToggleExpand: (id: number) => void;
  filterScore: string;
  onFilterScore: (s: string) => void;
}) {
  const filtered = filterScore
    ? reviews.filter((r) => r.score === Number(filterScore))
    : reviews;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total Reviews</p>
              <p className="text-xl font-bold">{stats.total.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Average Score</p>
              <p className="text-xl font-bold">{stats.averageScore > 0 ? stats.averageScore.toFixed(1) : "--"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Recent (30d)</p>
              <p className="text-xl font-bold">{stats.recentCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Recent Avg</p>
              <p className="text-xl font-bold">{stats.recentAverageScore > 0 ? stats.recentAverageScore.toFixed(1) : "--"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribution bar */}
      {stats && stats.total > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <DistributionBar distribution={stats.distribution} total={stats.total} />
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <Select
          value={filterScore}
          onChange={(e) => onFilterScore(e.target.value)}
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

      {/* Review cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center py-6">
              No reviews found. Run a check to fetch reviews.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => {
            const expanded = expandedReview === review.id;
            const scoreColor =
              review.score >= 4 ? "text-success" : review.score >= 3 ? "text-warning" : "text-destructive";
            return (
              <Card key={review.id} className="transition-colors hover:bg-card/80">
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
                          onClick={() => onToggleExpand(review.id)}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          {expanded ? "Show less" : "Show more"}
                        </button>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {review.author && (
                          <span className="text-xs text-muted-foreground">by {review.author}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {review.store.toUpperCase()}
                        </Badge>
                        {review.version && (
                          <span className="text-xs text-muted-foreground">v{review.version}</span>
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
          })}
        </div>
      )}
    </div>
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

function CompetitorsTab({
  ownApp,
  linkedCompetitors,
  allCompetitors,
  competitorOverviews,
  compareApp,
  compareData,
  ownRankings,
  loadingCompare,
  onCompare,
  onLink,
  onUnlink,
}: {
  ownApp: App;
  linkedCompetitors: App[];
  allCompetitors: App[];
  competitorOverviews: CompetitorOverview[];
  compareApp: string | null;
  compareData: CompetitorRankingEntry[];
  ownRankings: Ranking[];
  loadingCompare: boolean;
  onCompare: (appId: string) => void;
  onLink: (app: App) => void;
  onUnlink: (app: App) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Linked Competitors */}
      <Card>
        <CardHeader>
          <CardTitle>Linked Competitors ({linkedCompetitors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {linkedCompetitors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No competitors linked to this app.</p>
              <p className="text-xs mt-1">
                Use the link section below or the <a href="#/apps" className="text-primary underline">search</a> to add competitor apps.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {linkedCompetitors.map((app) => (
                <div key={app.app_id} className="rounded-lg border border-border p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{app.name || app.app_id}</p>
                      {app.developer && (
                        <p className="text-xs text-muted-foreground truncate">{app.developer}</p>
                      )}
                    </div>
                    <Badge variant="secondary">{app.platform}</Badge>
                  </div>
                  <div className="flex gap-1.5 mt-3">
                    <Button
                      size="sm"
                      variant={compareApp === app.app_id ? "default" : "outline"}
                      onClick={() => onCompare(app.app_id)}
                      className="flex-1"
                    >
                      {compareApp === app.app_id ? "Hide" : "Compare"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onUnlink(app)}
                    >
                      Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Link Competitor UI */}
          {(() => {
            const linkedIds = new Set(linkedCompetitors.map((c) => c.id));
            const unlinked = allCompetitors.filter((c) => !linkedIds.has(c.id));
            if (unlinked.length === 0) return null;
            return (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Link a competitor to this app:</p>
                <div className="flex gap-2 flex-wrap">
                  {unlinked.map((app) => (
                    <Button
                      key={app.id}
                      size="sm"
                      variant="outline"
                      onClick={() => onLink(app)}
                    >
                      + {app.name || app.app_id}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Comparison View */}
      {compareApp && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCompare ? (
              <SkeletonTable rows={5} cols={5} />
            ) : (
              <ComparisonTable
                ownAppName={ownApp.name || ownApp.app_id}
                competitorAppName={linkedCompetitors.find((a) => a.app_id === compareApp)?.name || compareApp}
                ownRankings={ownRankings}
                competitorRankings={compareData}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Keyword-Based Competitors */}
      {competitorOverviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Keyword-Based Competitors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Apps that appear in rankings for the same keywords as your app.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Shared Keywords</TableHead>
                  <TableHead className="text-right">Avg Rank Diff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitorOverviews.slice(0, 20).map((comp, idx) => (
                  <TableRow key={comp.appId} className={idx % 2 ? "bg-muted/30" : ""}>
                    <TableCell>
                      <div className="font-medium">{comp.appName || comp.appId}</div>
                      <div className="text-xs font-mono text-muted-foreground">{comp.appId}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{comp.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{comp.sharedKeywords}</TableCell>
                    <TableCell className="text-right">
                      {comp.avgRankDiff > 0 ? (
                        <Badge variant="success" className="font-mono">+{comp.avgRankDiff.toFixed(0)}</Badge>
                      ) : comp.avgRankDiff < 0 ? (
                        <Badge variant="destructive" className="font-mono">{comp.avgRankDiff.toFixed(0)}</Badge>
                      ) : (
                        <span className="text-muted-foreground font-mono">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ Comparison Table ============

interface ComparisonEntry {
  keyword: string;
  store: string;
  current_rank: number | null;
}

function ComparisonTable({
  ownAppName,
  competitorAppName,
  ownRankings,
  competitorRankings,
}: {
  ownAppName: string;
  competitorAppName: string;
  ownRankings: Ranking[];
  competitorRankings: CompetitorRankingEntry[];
}) {
  const compEntries: ComparisonEntry[] = competitorRankings.map((r) => ({
    keyword: r.keyword,
    store: r.store,
    current_rank: r.rank,
  }));

  const compMap = new Map<string, ComparisonEntry>();
  for (const r of compEntries) {
    compMap.set(`${r.keyword}:${r.store}`, r);
  }

  const allKeywords = new Map<string, { own?: ComparisonEntry; comp?: ComparisonEntry }>();
  for (const r of ownRankings) {
    const key = `${r.keyword}:${r.store}`;
    allKeywords.set(key, { own: r, comp: compMap.get(key) });
  }
  for (const r of compEntries) {
    const key = `${r.keyword}:${r.store}`;
    if (!allKeywords.has(key)) {
      allKeywords.set(key, { comp: r });
    }
  }

  const entries = Array.from(allKeywords.entries()).sort((a, b) => {
    const aOwn = a[1].own?.current_rank ?? 999;
    const bOwn = b[1].own?.current_rank ?? 999;
    return aOwn - bOwn;
  });

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No shared keywords to compare. Add keywords for both apps first.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Keyword</TableHead>
          <TableHead>Store</TableHead>
          <TableHead className="text-right">{ownAppName}</TableHead>
          <TableHead className="text-right">{competitorAppName}</TableHead>
          <TableHead className="text-right">Diff</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(([key, { own, comp }], idx) => {
          const ownRank = own?.current_rank;
          const compRank = comp?.current_rank;
          const diff = ownRank != null && compRank != null ? compRank - ownRank : null;

          return (
            <TableRow key={key} className={idx % 2 ? "bg-muted/30" : ""}>
              <TableCell className="font-medium">{own?.keyword || comp?.keyword}</TableCell>
              <TableCell>
                <Badge variant="outline">{(own?.store || comp?.store || "").toUpperCase()}</Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {ownRank != null ? (
                  <span className={ownRank <= 10 ? "text-success" : ownRank <= 50 ? "text-warning" : ""}>
                    #{ownRank}
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">
                {compRank != null ? (
                  <span className={compRank <= 10 ? "text-success" : compRank <= 50 ? "text-warning" : ""}>
                    #{compRank}
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {diff != null ? (
                  diff > 0 ? (
                    <Badge variant="success" className="font-mono">+{diff}</Badge>
                  ) : diff < 0 ? (
                    <Badge variant="destructive" className="font-mono">{diff}</Badge>
                  ) : (
                    <span className="text-muted-foreground font-mono">=</span>
                  )
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
