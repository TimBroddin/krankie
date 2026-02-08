import React, { useState, useEffect } from "react";
import { api, type Keyword, type App } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { SkeletonTable } from "../components/ui/skeleton";

type SortField = "keyword" | "store" | "app" | "last_checked";
type SortDir = "asc" | "desc";

export function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterApp, setFilterApp] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [sortField, setSortField] = useState<SortField>("keyword");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [filterApp, filterStore, filterPlatform]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [kws, appsList] = await Promise.all([
        api.getKeywords({
          appId: filterApp || undefined,
          store: filterStore || undefined,
          platform: filterPlatform || undefined,
        }),
        api.getApps(),
      ]);
      setKeywords(kws);
      setApps(appsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keywords");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteKeyword(id);
      setKeywords((prev) => prev.filter((k) => k.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete keyword");
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...keywords].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "keyword":
        cmp = a.keyword.localeCompare(b.keyword);
        break;
      case "store":
        cmp = a.store.localeCompare(b.store);
        break;
      case "app":
        cmp = (a.app_name || a.app_store_id).localeCompare(b.app_name || b.app_store_id);
        break;
      case "last_checked":
        cmp = (a.last_checked_at || "").localeCompare(b.last_checked_at || "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const uniqueStores = [...new Set(keywords.map((k) => k.store))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Keywords</h2>
          <p className="text-muted-foreground">Manage tracked keywords across apps and stores</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} disabled={apps.length === 0}>
          Add Keyword
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
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

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="6" cy="6" r="4.5" />
                  <path d="M14.5 14.5L9.5 9.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No keywords found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {apps.length === 0
                  ? "Add an app first, then you can track keywords."
                  : "Add keywords to start tracking their rankings."}
              </p>
              {apps.length > 0 && (
                <Button onClick={() => setShowAddDialog(true)}>Add Keyword</Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    sortable
                    sorted={sortField === "keyword" ? sortDir : false}
                    onSort={() => handleSort("keyword")}
                  >
                    Keyword
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "store" ? sortDir : false}
                    onSort={() => handleSort("store")}
                  >
                    Store
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "app" ? sortDir : false}
                    onSort={() => handleSort("app")}
                  >
                    App
                  </TableHead>
                  <TableHead
                    sortable
                    sorted={sortField === "last_checked" ? sortDir : false}
                    onSort={() => handleSort("last_checked")}
                  >
                    Last Checked
                  </TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((kw) => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">{kw.keyword}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{kw.store.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {kw.app_name || kw.app_store_id}
                      <Badge variant="secondary" className="ml-2 text-[10px]">{kw.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {kw.last_checked_at ? formatRelativeTime(kw.last_checked_at) : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(kw.id)}
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

      <AddKeywordDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdded={() => {
          setShowAddDialog(false);
          loadData();
        }}
        apps={apps}
      />

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
            <Button variant="destructive" onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddKeywordDialog({
  open,
  onClose,
  onAdded,
  apps,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  apps: App[];
}) {
  const [appId, setAppId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [store, setStore] = useState("us");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && apps.length > 0 && !appId) {
      setAppId(apps[0].app_id);
    }
  }, [open, apps]);

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
