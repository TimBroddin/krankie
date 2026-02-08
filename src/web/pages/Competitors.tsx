import React, { useState, useEffect } from "react";
import { api, type App, type CompetitorOverview, type Ranking } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonTable } from "../components/ui/skeleton";

export function CompetitorsPage() {
  const [ownApps, setOwnApps] = useState<App[]>([]);
  const [competitorApps, setCompetitorApps] = useState<App[]>([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const [compareApp, setCompareApp] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<Ranking[]>([]);
  const [ownRankings, setOwnRankings] = useState<Ranking[]>([]);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  async function loadApps() {
    setLoading(true);
    try {
      const [own, comp] = await Promise.all([
        api.getApps({ isOwn: true }),
        api.getApps({ isOwn: false }),
      ]);
      setOwnApps(own);
      setCompetitorApps(comp);
      if (own.length > 0) {
        setSelectedApp(own[0]!.app_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load apps");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedApp) {
      loadCompetitors(selectedApp);
    }
  }, [selectedApp]);

  async function loadCompetitors(appId: string) {
    setLoadingCompetitors(true);
    setCompareApp(null);
    setCompareData([]);
    setOwnRankings([]);
    try {
      const data = await api.getCompetitors(appId);
      setCompetitors(data.competitors);
    } catch (err) {
      setCompetitors([]);
    } finally {
      setLoadingCompetitors(false);
    }
  }

  async function handleCompare(competitorAppId: string) {
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
        api.getRankings({ appId: selectedApp }),
        api.getRankings({ appId: competitorAppId }),
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitors</h2>
          <p className="text-muted-foreground mt-1">Analyze and compare competitor apps</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <SkeletonTable rows={5} cols={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Competitors</h2>
          <p className="text-muted-foreground mt-1">Analyze and compare competitor apps</p>
        </div>
        {ownApps.length > 0 && (
          <Select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            options={ownApps.map((a) => ({
              value: a.app_id,
              label: a.name || a.app_id,
            }))}
            className="w-56"
          />
        )}
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {ownApps.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div
                className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(45,212,191,0.15) 100%)" }}
              >
                <svg className="h-6 w-6 text-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="5" cy="5" r="3" />
                  <circle cx="11" cy="5" r="3" />
                  <path d="M8 11c-3 0-5 1.5-5 3h10c0-1.5-2-3-5-3Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No own apps yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your app first in the Research page, then track competitors here.
              </p>
              <a href="#/research">
                <Button>Go to Research</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tracked Competitors */}
          <Card>
            <CardHeader>
              <CardTitle>
                Tracked Competitors ({competitorApps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {competitorApps.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No competitor apps tracked yet.</p>
                  <p className="text-xs mt-1">
                    Use the <a href="#/research" className="text-primary underline">Research page</a> to add competitor apps.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {competitorApps.map((app) => (
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
                        <MiniFlag active={!!app.track_keywords} label="Keywords" />
                        <MiniFlag active={!!app.track_ratings} label="Ratings" />
                        <MiniFlag active={!!app.track_reviews} label="Reviews" />
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant={compareApp === app.app_id ? "default" : "outline"}
                          onClick={() => handleCompare(app.app_id)}
                          className="w-full"
                        >
                          {compareApp === app.app_id ? "Hide Comparison" : "Compare Rankings"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Keyword Overlap (from API) */}
          {loadingCompetitors ? (
            <Card>
              <CardContent className="pt-6">
                <SkeletonTable rows={5} cols={3} />
              </CardContent>
            </Card>
          ) : competitors.length > 0 && (
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
                    {competitors.slice(0, 20).map((comp, idx) => (
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
                    ownAppId={selectedApp}
                    ownAppName={ownApps.find((a) => a.app_id === selectedApp)?.name || selectedApp}
                    competitorAppId={compareApp}
                    competitorAppName={competitorApps.find((a) => a.app_id === compareApp)?.name || compareApp}
                    ownRankings={ownRankings}
                    competitorRankings={compareData}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ComparisonTable({
  ownAppName,
  competitorAppName,
  ownRankings,
  competitorRankings,
}: {
  ownAppId: string;
  ownAppName: string;
  competitorAppId: string;
  competitorAppName: string;
  ownRankings: Ranking[];
  competitorRankings: Ranking[];
}) {
  // Build a map of keyword+store → rankings for comparison
  const compMap = new Map<string, Ranking>();
  for (const r of competitorRankings) {
    compMap.set(`${r.keyword}:${r.store}`, r);
  }

  const allKeywords = new Map<string, { own?: Ranking; comp?: Ranking }>();
  for (const r of ownRankings) {
    const key = `${r.keyword}:${r.store}`;
    allKeywords.set(key, { own: r, comp: compMap.get(key) });
  }
  for (const r of competitorRankings) {
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

function MiniFlag({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
      active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
    }`}>
      {label}
    </span>
  );
}
