import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { Tabs, type Tab } from "./components/Tabs";
import { Overview } from "./views/Overview";
import { Apps } from "./views/Apps";
import { AppDetail } from "./views/AppDetail";
import { Keywords } from "./views/Keywords";
import { History } from "./views/History";
import {
  getStats,
  getMovers,
  listApps,
  listKeywords,
  getCurrentRankings,
  type DbStats,
  type RankingWithKeyword,
  type App as AppType,
} from "../db";
import { CONFIG } from "../config";
import { existsSync, readFileSync } from "fs";

type TabId = "overview" | "apps" | "keywords" | "history";

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "apps", label: "Apps" },
  { id: "keywords", label: "Keywords" },
  { id: "history", label: "History" },
];

export default function App(): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows ?? 24);
  const [terminalWidth, setTerminalWidth] = useState(stdout?.columns ?? 80);

  useEffect(() => {
    const handleResize = () => {
      if (stdout) {
        setTerminalHeight(stdout.rows);
        setTerminalWidth(stdout.columns);
      }
    };

    stdout?.on("resize", handleResize);
    return () => {
      stdout?.off("resize", handleResize);
    };
  }, [stdout]);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<DbStats | null>(null);
  const [movers, setMovers] = useState<RankingWithKeyword[]>([]);
  const [apps, setApps] = useState<AppType[]>([]);
  const [keywordCounts, setKeywordCounts] = useState<Map<string, number>>(new Map());
  const [rankings, setRankings] = useState<RankingWithKeyword[]>([]);
  const [recentLogs, setRecentLogs] = useState<string[]>([]);

  const [selectedAppIndex, setSelectedAppIndex] = useState(0);
  const [selectedKeywordIndex, setSelectedKeywordIndex] = useState(0);
  const [selectedApp, setSelectedApp] = useState<AppType | null>(null);
  const [selectedStoreIndex, setSelectedStoreIndex] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [statsData, moversData, appsData, keywordsData, rankingsData] =
        await Promise.all([
          getStats(),
          getMovers({ days: 1, minChange: 1 }),
          listApps(),
          listKeywords(),
          getCurrentRankings(),
        ]);

      setStats(statsData);
      setMovers(moversData);
      setApps(appsData);
      setRankings(rankingsData);

      // Calculate keyword counts per app
      const counts = new Map<string, number>();
      keywordsData.forEach((k) => {
        const count = counts.get(k.app_store_id) ?? 0;
        counts.set(k.app_store_id, count + 1);
      });
      setKeywordCounts(counts);

      // Load recent logs
      if (existsSync(CONFIG.logPath)) {
        const content = readFileSync(CONFIG.logPath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        setRecentLogs(lines.slice(-10));
      }
    } catch (error) {
      // Database might not exist yet
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadData]);

  const getStoresForApp = (app: AppType): string[] => {
    const stores = new Set<string>();
    rankings.forEach((r) => {
      if (r.app_store_id === app.app_id) {
        stores.add(r.store);
      }
    });
    return Array.from(stores).sort();
  };

  useInput((input, key) => {
    // Global: quit
    if (input === "q") {
      exit();
      return;
    }

    // Global: refresh
    if (input === "r") {
      loadData();
      return;
    }

    // Escape: go back
    if (key.escape) {
      if (selectedApp) {
        setSelectedApp(null);
        setSelectedStoreIndex(0);
      }
      return;
    }

    // Tab navigation (left/right arrows)
    if (key.leftArrow && !selectedApp) {
      const idx = TABS.findIndex((t) => t.id === activeTab);
      const newIdx = idx > 0 ? idx - 1 : TABS.length - 1;
      setActiveTab(TABS[newIdx]!.id as TabId);
      return;
    }
    if (key.rightArrow && !selectedApp) {
      const idx = TABS.findIndex((t) => t.id === activeTab);
      const newIdx = idx < TABS.length - 1 ? idx + 1 : 0;
      setActiveTab(TABS[newIdx]!.id as TabId);
      return;
    }

    // Tab key: switch store in app detail view
    if (key.tab && selectedApp) {
      const stores = getStoresForApp(selectedApp);
      if (stores.length > 0) {
        setSelectedStoreIndex((prev) => (prev + 1) % stores.length);
      }
      return;
    }

    // Up/down navigation in lists
    if (key.upArrow) {
      if (activeTab === "apps" && !selectedApp) {
        setSelectedAppIndex((prev) => Math.max(0, prev - 1));
      } else if (activeTab === "keywords") {
        setSelectedKeywordIndex((prev) => Math.max(0, prev - 1));
      }
      return;
    }
    if (key.downArrow) {
      if (activeTab === "apps" && !selectedApp) {
        setSelectedAppIndex((prev) => Math.min(apps.length - 1, prev + 1));
      } else if (activeTab === "keywords") {
        setSelectedKeywordIndex((prev) => Math.min(rankings.length - 1, prev + 1));
      }
      return;
    }

    // Enter: select app
    if (key.return && activeTab === "apps" && !selectedApp && apps[selectedAppIndex]) {
      setSelectedApp(apps[selectedAppIndex]);
      setSelectedStoreIndex(0);
      return;
    }
  });

  const stores = selectedApp ? getStoresForApp(selectedApp) : [];
  const currentStore = stores[selectedStoreIndex] ?? "";

  // Calculate content height (terminal height minus header, tabs, footer, borders)
  const contentHeight = Math.max(terminalHeight - 8, 10);

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      <Box marginBottom={1} justifyContent="space-between" paddingX={1}>
        <Text bold color="cyan">
          krankie
        </Text>
        <Text dimColor>
          {stats?.lastCheck
            ? `Last check: ${getRelativeTime(new Date(stats.lastCheck))}`
            : ""}
        </Text>
      </Box>

      <Box marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Tabs tabs={TABS} activeTab={activeTab} />
      </Box>

      <Box flexDirection="column" height={contentHeight} paddingX={1}>
        {activeTab === "overview" && stats && (
          <Overview stats={stats} movers={movers} />
        )}

        {activeTab === "apps" && !selectedApp && (
          <Apps
            apps={apps}
            keywordCounts={keywordCounts}
            selectedIndex={selectedAppIndex}
            onSelect={setSelectedApp}
          />
        )}

        {activeTab === "apps" && selectedApp && (
          <AppDetail
            app={selectedApp}
            rankings={rankings.filter((r) => r.app_store_id === selectedApp.app_id)}
            stores={stores}
            selectedStore={currentStore}
          />
        )}

        {activeTab === "keywords" && (
          <Keywords rankings={rankings} selectedIndex={selectedKeywordIndex} />
        )}

        {activeTab === "history" && stats && (
          <History stats={stats} recentLogs={recentLogs} />
        )}

        {!stats && (
          <Text dimColor>Loading... (run 'krankie init' if this persists)</Text>
        )}
      </Box>

      <Box flexGrow={1} />

      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          q: quit | r: refresh | ←→: tabs | ↑↓: navigate | Enter: select | Esc: back
        </Text>
      </Box>
    </Box>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
