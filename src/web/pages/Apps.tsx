import React, { useState, useEffect } from "react";
import { api, type App, type SearchResult } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { SkeletonTable } from "../components/ui/skeleton";

export function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

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

  async function handleDelete(appId: string) {
    try {
      await api.deleteApp(appId);
      setApps((prev) => prev.filter((a) => a.app_id !== appId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete app");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Apps</h2>
          <p className="text-muted-foreground">Manage your tracked applications</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>Add App</Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : apps.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="12" height="12" rx="3" />
                  <path d="M8 5v6M5 8h6" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No apps tracked</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Search the App Store to add your first application.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>Search App Store</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>App ID</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.app_id}>
                    <TableCell className="font-medium">
                      {app.name || app.app_id}
                      {app.developer && (
                        <span className="block text-xs text-muted-foreground">{app.developer}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={app.is_own ? "success" : "outline"}>
                        {app.is_own ? "OWN" : "COMP"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {app.app_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{app.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(app.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(app.app_id)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddAppDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={() => {
          setShowAddDialog(false);
          loadApps();
        }}
      />

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

function AddAppDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("iphone");

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const results = await api.search(searchQuery, undefined, platform);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd(result: SearchResult, isOwn: boolean = true) {
    setAdding(result.appId);
    setError(null);
    try {
      await api.createApp({
        appId: result.appId,
        platform,
        name: result.title,
        developer: result.developer,
        isOwn,
        trackKeywords: isOwn,
        trackRatings: isOwn,
        trackReviews: isOwn,
      });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app");
    } finally {
      setAdding(null);
    }
  }

  function handleClose() {
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add App</DialogTitle>
          <DialogDescription>Search the App Store to find and track an application.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search app name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              options={[
                { value: "iphone", label: "iPhone" },
                { value: "ipad", label: "iPad" },
                { value: "mac", label: "Mac" },
              ]}
              className="w-28"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? "..." : "Search"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {searchResults.map((result) => (
                <div
                  key={result.appId}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
                >
                  {result.icon && (
                    <img
                      src={result.icon}
                      alt=""
                      className="h-10 w-10 rounded-lg shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{result.developer}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {result.score > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {result.score.toFixed(1)} stars
                        </span>
                      )}
                      {result.free && (
                        <Badge variant="secondary" className="text-[10px]">Free</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleAdd(result, true)}
                      disabled={adding === result.appId}
                    >
                      {adding === result.appId ? "..." : "Own"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdd(result, false)}
                      disabled={adding === result.appId}
                    >
                      Watch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && !searching && searchQuery && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No results found. Try a different search term.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
