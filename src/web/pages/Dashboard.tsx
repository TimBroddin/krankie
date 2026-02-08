import React, { useState, useEffect } from "react";
import { api, type Stats, type Ranking } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { SkeletonCard, SkeletonTable } from "../components/ui/skeleton";

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [movers, setMovers] = useState<Ranking[] | null>(null);
  const [ownCount, setOwnCount] = useState(0);
  const [compCount, setCompCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkRunning, setCheckRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [statsData, moversData, ownApps, compApps] = await Promise.all([
        api.getStats(),
        api.getMovers({ days: 1, minChange: 1 }).catch(() => []),
        api.getApps({ isOwn: true }).catch(() => []),
        api.getApps({ isOwn: false }).catch(() => []),
      ]);
      setStats(statsData);
      setMovers(moversData);
      setOwnCount(ownApps.length);
      setCompCount(compApps.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunCheck() {
    setCheckRunning(true);
    try {
      await api.runCheck();
      setTimeout(loadData, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setCheckRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground mt-1">Overview of your ASO tracking</p>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Top Movers (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <SkeletonTable rows={5} cols={5} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadData}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasData = stats && (stats.appCount > 0 || stats.keywordCount > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of your ASO tracking</p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.lastCheck && (
            <span className="text-xs text-muted-foreground font-mono">
              Last check: {formatRelativeTime(stats.lastCheck)}
            </span>
          )}
          <Button
            onClick={handleRunCheck}
            disabled={checkRunning}
            size="sm"
            className="relative"
            style={!checkRunning ? { boxShadow: "0 0 12px rgba(13, 148, 136, 0.25)" } : undefined}
          >
            {checkRunning ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin mr-1" />
                Running...
              </>
            ) : (
              "Run Check"
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Apps"
          value={stats?.appCount ?? 0}
          description={`${ownCount} own, ${compCount} competitors`}
          icon={<AppsStatIcon />}
          gradientColor="teal"
        />
        <StatCard
          title="Keywords"
          value={stats?.keywordCount ?? 0}
          description="monitored keywords"
          icon={<KeywordsStatIcon />}
          gradientColor="amber"
        />
        <StatCard
          title="Stores"
          value={stats?.storeCount ?? 0}
          description="country stores"
          icon={<StoresStatIcon />}
          gradientColor="violet"
        />
        <StatCard
          title="Rankings"
          value={stats?.rankingCount ?? 0}
          description="total data points"
          icon={<RankingsStatIcon />}
          gradientColor="blue"
        />
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div
                className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(45,212,191,0.15) 100%)",
                }}
              >
                <svg className="h-6 w-6 text-primary" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1.5L9.8 5.2L14 5.7L10.9 8.6L11.7 12.8L8 10.8L4.3 12.8L5.1 8.6L2 5.7L6.2 5.2Z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-1">No data yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by adding an app and some keywords to track.
              </p>
              <a href="#/research">
                <Button>Add Your First App</Button>
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Top Movers (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            {movers && movers.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>App</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movers.slice(0, 10).map((m, idx) => (
                    <TableRow
                      key={`${m.keyword_id}`}
                      className={idx % 2 === 0 ? "" : "bg-muted/30"}
                    >
                      <TableCell className="font-medium">{m.keyword}</TableCell>
                      <TableCell className="text-muted-foreground">{m.app_name || m.app_store_id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.store.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {m.current_rank ?? "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RankChange change={m.rank_change} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No ranking changes in the last 24 hours.</p>
                <p className="text-xs mt-1">Rankings are checked periodically. Run a check to get fresh data.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const GRADIENT_COLORS = {
  teal: {
    bg: "radial-gradient(circle at top right, rgba(13,148,136,0.08) 0%, transparent 60%)",
    bgDark: "radial-gradient(circle at top right, rgba(45,212,191,0.1) 0%, transparent 60%)",
    iconBg: "rgba(13,148,136,0.12)",
    iconBgDark: "rgba(45,212,191,0.15)",
    iconColor: "#0d9488",
    iconColorDark: "#2dd4bf",
  },
  amber: {
    bg: "radial-gradient(circle at top right, rgba(217,119,6,0.08) 0%, transparent 60%)",
    bgDark: "radial-gradient(circle at top right, rgba(251,191,36,0.1) 0%, transparent 60%)",
    iconBg: "rgba(217,119,6,0.12)",
    iconBgDark: "rgba(251,191,36,0.15)",
    iconColor: "#d97706",
    iconColorDark: "#fbbf24",
  },
  violet: {
    bg: "radial-gradient(circle at top right, rgba(124,58,237,0.08) 0%, transparent 60%)",
    bgDark: "radial-gradient(circle at top right, rgba(167,139,250,0.1) 0%, transparent 60%)",
    iconBg: "rgba(124,58,237,0.12)",
    iconBgDark: "rgba(167,139,250,0.15)",
    iconColor: "#7c3aed",
    iconColorDark: "#a78bfa",
  },
  blue: {
    bg: "radial-gradient(circle at top right, rgba(37,99,235,0.08) 0%, transparent 60%)",
    bgDark: "radial-gradient(circle at top right, rgba(96,165,250,0.1) 0%, transparent 60%)",
    iconBg: "rgba(37,99,235,0.12)",
    iconBgDark: "rgba(96,165,250,0.15)",
    iconColor: "#2563eb",
    iconColorDark: "#60a5fa",
  },
} as const;

function StatCard({
  title,
  value,
  description,
  icon,
  gradientColor,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  gradientColor: keyof typeof GRADIENT_COLORS;
}) {
  const colors = GRADIENT_COLORS[gradientColor];
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <Card className="relative overflow-hidden">
      {/* Radial gradient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: isDark ? colors.bgDark : colors.bg }}
      />
      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: isDark ? colors.iconBgDark : colors.iconBg,
            color: isDark ? colors.iconColorDark : colors.iconColor,
          }}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-3xl font-bold font-mono tracking-tight">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
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

function AppsStatIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="3" />
    </svg>
  );
}

function KeywordsStatIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M14.5 14.5L9.5 9.5" />
    </svg>
  );
}

function StoresStatIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M1.5 8h13M8 1.5c-2 2-3 4-3 6.5s1 4.5 3 6.5c2-2 3-4 3-6.5s-1-4.5-3-6.5" />
    </svg>
  );
}

function RankingsStatIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 14V9M6 14V6M10 14V4M14 14V2" />
    </svg>
  );
}
