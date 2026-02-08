import React, { useState, useEffect } from "react";
import { api, type App, type SearchResult } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonTable } from "../components/ui/skeleton";

export function ResearchPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "own" | "competitor">("all");
  const [platformFilter, setPlatformFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchPlatform, setSearchPlatform] = useState("iphone");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [appDetails, setAppDetails] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadApps(); }, []);

  async function loadApps() {
    setLoading(true);
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
      await api.createApp({
        appId: result.appId,
        platform: searchPlatform,
        name: result.title,
        developer: result.developer,
        isOwn,
        trackKeywords: isOwn,
        trackRatings: isOwn,
        trackReviews: isOwn,
      });
      loadApps();
      setSearchResults((prev) => prev.filter((r) => r.appId !== result.appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app");
    }
  }

  async function handleToggle(appId: string, field: "trackKeywords" | "trackRatings" | "trackReviews", value: boolean) {
    try {
      await api.updateApp(appId, { [field]: value });
      setApps((prev) => prev.map((a) =>
        a.app_id === appId ? { ...a, [field === "trackKeywords" ? "track_keywords" : field === "trackRatings" ? "track_ratings" : "track_reviews"]: value ? 1 : 0 } : a
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
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

  async function handleExpandApp(appId: string) {
    if (expandedApp === appId) {
      setExpandedApp(null);
      return;
    }
    setExpandedApp(appId);
    if (!appDetails[appId]) {
      try {
        const details = await api.getAppDetails(appId);
        setAppDetails((prev) => ({ ...prev, [appId]: details }));
      } catch {
        // silently fail
      }
    }
  }

  async function handleDelete(appId: string) {
    try {
      await api.deleteApp(appId);
      setApps((prev) => prev.filter((a) => a.app_id !== appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const trackedAppIds = new Set(apps.map((a) => a.app_id));

  const filteredApps = apps.filter((a) => {
    if (filter === "own" && !a.is_own) return false;
    if (filter === "competitor" && a.is_own) return false;
    if (platformFilter && a.platform !== platformFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">App Research</h2>
        <p className="text-muted-foreground mt-1">Search the App Store, track your apps and competitors</p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search App Store</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by app name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Select
              value={searchPlatform}
              onChange={(e) => setSearchPlatform(e.target.value)}
              options={[
                { value: "iphone", label: "iPhone" },
                { value: "ipad", label: "iPad" },
                { value: "mac", label: "Mac" },
              ]}
              className="w-28"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive mt-3">{error}</p>}

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
                          Track as Own
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAddApp(result, false)}>
                          Watch
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

      {/* Tracked Apps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tracked Apps</CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                options={[
                  { value: "", label: "All Platforms" },
                  { value: "iphone", label: "iPhone" },
                  { value: "ipad", label: "iPad" },
                  { value: "mac", label: "Mac" },
                ]}
                className="w-36"
              />
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["all", "own", "competitor"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {f === "all" ? "All" : f === "own" ? "My Apps" : "Competitors"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No apps found. Search above to add your first app.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map((app) => (
                  <React.Fragment key={app.app_id}>
                    <TableRow className="cursor-pointer" onClick={() => handleExpandApp(app.app_id)}>
                      <TableCell>
                        <div className="font-medium">{app.name || app.app_id}</div>
                        {app.developer && (
                          <div className="text-xs text-muted-foreground">{app.developer}</div>
                        )}
                        <div className="text-xs font-mono text-muted-foreground/60">{app.app_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={app.is_own ? "success" : "outline"}
                          className="cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleSetOwn(app.app_id, !app.is_own); }}
                        >
                          {app.is_own ? "OWN" : "COMP"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{app.platform}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <TrackingToggle label="K" active={!!app.track_keywords} onClick={(e) => { e.stopPropagation(); handleToggle(app.app_id, "trackKeywords", !app.track_keywords); }} title="Keyword tracking" />
                          <TrackingToggle label="R" active={!!app.track_ratings} onClick={(e) => { e.stopPropagation(); handleToggle(app.app_id, "trackRatings", !app.track_ratings); }} title="Ratings tracking" />
                          <TrackingToggle label="V" active={!!app.track_reviews} onClick={(e) => { e.stopPropagation(); handleToggle(app.app_id, "trackReviews", !app.track_reviews); }} title="Reviews tracking" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleExpandApp(app.app_id); }}>
                            {expandedApp === app.app_id ? "Collapse" : "Details"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(app.app_id); }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedApp === app.app_id && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <AppDetailsPanel appId={app.app_id} details={appDetails[app.app_id]} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TrackingToggle({ label, active, onClick, title }: { label: string; active: boolean; onClick: (e: React.MouseEvent) => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-all ${
        active
          ? "bg-primary/15 text-primary border border-primary/30"
          : "bg-muted text-muted-foreground border border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

function AppDetailsPanel({ appId, details }: { appId: string; details: any }) {
  if (!details) {
    return (
      <div className="py-4 text-sm text-muted-foreground">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin mr-2" />
        Loading details...
      </div>
    );
  }

  return (
    <div className="py-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailItem label="Rating" value={details.score ? `${details.score.toFixed(1)} (${details.ratings?.toLocaleString()} ratings)` : "N/A"} />
        <DetailItem label="Price" value={details.price === 0 ? "Free" : `$${details.price}`} />
        <DetailItem label="Version" value={details.version || "N/A"} />
        <DetailItem label="Size" value={details.size || "N/A"} />
        <DetailItem label="Category" value={details.genres?.[0] || "N/A"} />
        <DetailItem label="Min OS" value={details.requiredOsVersion || "N/A"} />
        <DetailItem label="Released" value={details.released ? new Date(details.released).toLocaleDateString() : "N/A"} />
        <DetailItem label="Updated" value={details.updated ? new Date(details.updated).toLocaleDateString() : "N/A"} />
      </div>
      {details.description && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground/80 line-clamp-3">{details.description}</p>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
