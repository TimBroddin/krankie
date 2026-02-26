import React, { useState, useEffect } from "react";
import { api, type App, type KeywordCandidate, type CompetitorInfo, type KeywordFinderResult } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";

type Mode = "seed" | "app";

export function ResearchPage() {
  const [mode, setMode] = useState<Mode>("seed");
  const [apps, setApps] = useState<App[]>([]);
  const [allApps, setAllApps] = useState<App[]>([]);
  const [seed, setSeed] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const [store, setStore] = useState("us");
  const [platform, setPlatform] = useState("iphone");
  const [depth, setDepth] = useState("shallow");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<KeywordFinderResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [trackingKeyword, setTrackingKeyword] = useState<string | null>(null);
  const [trackingComp, setTrackingComp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trackedAppIds = new Set(allApps.map((a) => a.app_id));

  useEffect(() => {
    Promise.all([
      api.getApps({ isOwn: true }),
      api.getApps(),
    ]).then(([ownApps, all]) => {
      setApps(ownApps);
      setAllApps(all);
    }).catch(() => {});
  }, []);

  async function handleFind() {
    if (mode === "seed" && !seed.trim()) return;
    if (mode === "app" && !selectedApp) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setSelected(new Set());

    try {
      if (mode === "seed") {
        const data = await api.findKeywords({
          seed: seed.trim(),
          store,
          platform,
          depth,
          compareAppId: selectedApp || undefined,
        });
        setResult(data);
      } else {
        const data = await api.discoverOpportunities({
          appId: selectedApp,
          store,
          platform,
          depth,
        });
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setRunning(false);
    }
  }

  function toggleSelect(keyword: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  }

  function selectAll() {
    if (!result) return;
    if (selected.size === result.keywords.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.keywords.map((k) => k.keyword)));
    }
  }

  async function handleTrackKeyword(keyword: string) {
    if (!selectedApp) return;
    setTrackingKeyword(keyword);
    try {
      await api.addKeyword({ appId: selectedApp, keyword, store });
    } catch {
      // may already exist
    }
    setTrackingKeyword(null);
  }

  async function handleTrackSelected() {
    if (!selectedApp || selected.size === 0) return;
    setRunning(true);
    for (const keyword of selected) {
      try {
        await api.addKeyword({ appId: selectedApp, keyword, store });
      } catch {
        // skip duplicates
      }
    }
    setSelected(new Set());
    setRunning(false);
  }

  async function handleAddCompetitor(comp: CompetitorInfo) {
    setTrackingComp(comp.appId);
    try {
      const newApp = await api.createApp({
        appId: comp.appId,
        platform,
        name: comp.name,
        developer: comp.developer,
        isOwn: false,
      });
      // Auto-link to the selected own app
      if (selectedApp) {
        const ownApp = apps.find((a) => a.app_id === selectedApp);
        if (ownApp) {
          await api.linkCompetitor(ownApp.id, newApp.id);
        }
      }
      // Refresh allApps so the button updates to "Tracked"
      const refreshed = await api.getApps();
      setAllApps(refreshed);
    } catch {
      // may already exist
    }
    setTrackingComp(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Research</h2>
        <p className="text-muted-foreground mt-1">Discover keyword opportunities by analyzing competitors</p>
      </div>

      {/* Mode selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setMode("seed")}
          className={`text-left rounded-xl border p-5 transition-colors ${
            mode === "seed"
              ? "border-primary/40 bg-primary/[0.03]"
              : "border-border hover:border-primary/20"
          }`}
        >
          <p className={`text-sm font-semibold mb-1 ${mode === "seed" ? "text-primary" : ""}`}>
            Search by Keyword
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter a keyword, and we'll find the top ranking apps for it. Then we analyze what other keywords those apps rank for — revealing related keywords you might want to target.
          </p>
        </button>
        <button
          onClick={() => setMode("app")}
          className={`text-left rounded-xl border p-5 transition-colors ${
            mode === "app"
              ? "border-primary/40 bg-primary/[0.03]"
              : "border-border hover:border-primary/20"
          }`}
        >
          <p className={`text-sm font-semibold mb-1 ${mode === "app" ? "text-primary" : ""}`}>
            Analyze Competitor Keywords
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pick one of your apps. We'll look at its top competitors and find the keywords they rank for that you don't — uncovering gaps and opportunities.
          </p>
        </button>
      </div>

      {/* Search controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {mode === "seed" ? (
                <Input
                  placeholder="Enter a seed keyword, e.g. 'photo editor'..."
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFind()}
                  className="flex-1 min-w-[200px]"
                />
              ) : (
                <Select
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                  options={[
                    { value: "", label: "Select your app..." },
                    ...apps.map((a) => ({
                      value: a.app_id,
                      label: a.name || a.app_id,
                    })),
                  ]}
                  className="flex-1 min-w-[200px]"
                />
              )}

              {mode === "seed" && apps.length > 0 && (
                <Select
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value)}
                  options={[
                    { value: "", label: "Compare with your app..." },
                    ...apps.map((a) => ({
                      value: a.app_id,
                      label: a.name || a.app_id,
                    })),
                  ]}
                  className="w-52"
                />
              )}

              <Select
                value={store}
                onChange={(e) => setStore(e.target.value)}
                options={[
                  { value: "us", label: "US" },
                  { value: "gb", label: "UK" },
                  { value: "de", label: "DE" },
                  { value: "fr", label: "FR" },
                  { value: "jp", label: "JP" },
                  { value: "be", label: "BE" },
                  { value: "nl", label: "NL" },
                ]}
                className="w-20 shrink-0"
              />
              <Select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                options={[
                  { value: "iphone", label: "iPhone" },
                  { value: "ipad", label: "iPad" },
                  { value: "mac", label: "Mac" },
                ]}
                className="w-28 shrink-0"
              />
              <Select
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                options={[
                  { value: "shallow", label: "Quick" },
                  { value: "deep", label: "Deep" },
                ]}
                className="w-24 shrink-0"
              />
              <Button onClick={handleFind} disabled={running} className="shrink-0">
                {running ? (
                  <>
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin mr-1.5" />
                    Analyzing...
                  </>
                ) : (
                  "Discover"
                )}
              </Button>
            </div>

            {depth === "deep" && (
              <p className="text-xs text-muted-foreground">
                Deep mode verifies rankings for top candidates. This takes longer (30-60s).
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat label="Keywords Found" value={result.keywords.length} />
            <MiniStat label="Apps Analyzed" value={result.analyzedApps} />
            <MiniStat label="API Calls" value={result.apiCalls} />
            <MiniStat label="Elapsed" value={result.elapsed} />
          </div>

          {result.compareRank != null && (
            <Card className="border-primary/30">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm">
                  {result.compareRank
                    ? <>Your app ranks <span className="font-bold text-primary">#{result.compareRank}</span> for "{result.seed}"</>
                    : <>Your app is <span className="font-bold text-destructive">not ranked</span> for "{result.seed}"</>
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Keywords table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Discovered Keywords ({result.keywords.length})</CardTitle>
                {selectedApp && selected.size > 0 && (
                  <Button size="sm" onClick={handleTrackSelected} disabled={running}>
                    Track Selected ({selected.size})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {result.keywords.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No keyword opportunities found. Try a different seed or lower the minimum apps threshold.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedApp && (
                        <TableHead className="w-[40px]">
                          <input
                            type="checkbox"
                            checked={selected.size === result.keywords.length}
                            onChange={selectAll}
                            className="rounded"
                          />
                        </TableHead>
                      )}
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Apps</TableHead>
                      <TableHead>Source</TableHead>
                      {depth === "deep" && <TableHead>Competition</TableHead>}
                      {selectedApp && <TableHead className="w-[80px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.keywords.map((kw, idx) => (
                      <TableRow key={kw.keyword} className={idx % 2 ? "bg-muted/30" : ""}>
                        {selectedApp && (
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selected.has(kw.keyword)}
                              onChange={() => toggleSelect(kw.keyword)}
                              className="rounded"
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="font-medium">{kw.keyword}</div>
                          {kw.longTail && (
                            <span className="text-xs text-muted-foreground">long-tail</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{kw.score}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono">{kw.frequency}</span>
                          <span className="text-muted-foreground text-xs">/{result.analyzedApps}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {kw.foundIn.map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px]">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        {depth === "deep" && (
                          <TableCell>
                            {kw.competition && (
                              <Badge
                                variant={
                                  kw.competition === "low" ? "success" :
                                  kw.competition === "medium" ? "warning" : "destructive"
                                }
                              >
                                {kw.competition}
                              </Badge>
                            )}
                          </TableCell>
                        )}
                        {selectedApp && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTrackKeyword(kw.keyword)}
                              disabled={trackingKeyword === kw.keyword}
                              className="text-xs"
                            >
                              {trackingKeyword === kw.keyword ? "..." : "Track"}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Competitors */}
          {result.competitors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Competitors Analyzed ({result.competitors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.competitors.map((comp) => {
                    const isTracked = trackedAppIds.has(comp.appId);
                    return (
                      <div key={comp.appId} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold font-mono">
                          #{comp.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{comp.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{comp.developer}</p>
                        </div>
                        {comp.rating && (
                          <span className="text-xs text-muted-foreground shrink-0">{comp.rating.toFixed(1)}★</span>
                        )}
                        {isTracked ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">Tracked</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAddCompetitor(comp)}
                            disabled={trackingComp === comp.appId}
                            className="text-xs shrink-0"
                          >
                            {trackingComp === comp.appId ? "..." : "+ Competitor"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold font-mono">{value}</p>
      </CardContent>
    </Card>
  );
}
