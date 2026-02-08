import React, { useState, useEffect } from "react";
import { DashboardPage } from "./pages/Dashboard";
import { AppsPage } from "./pages/Apps";
import { KeywordsPage } from "./pages/Keywords";
import { RankingsPage } from "./pages/Rankings";
import { RatingsPage } from "./pages/Ratings";
import { ReviewsPage } from "./pages/Reviews";
import { ResearchPage } from "./pages/Research";
import { DiscoverPage } from "./pages/Discover";
import { CompetitorsPage } from "./pages/Competitors";

const ROUTES = {
  "#/": { label: "Dashboard", icon: DashboardIcon },
  "#/apps": { label: "Apps", icon: AppsIcon },
  "#/research": { label: "Research", icon: ResearchIcon },
  "#/keywords": { label: "Keywords", icon: KeywordsIcon },
  "#/discover": { label: "Discover", icon: DiscoverIcon },
  "#/rankings": { label: "Rankings", icon: RankingsIcon },
  "#/competitors": { label: "Competitors", icon: CompetitorsIcon },
  "#/ratings": { label: "Ratings", icon: RatingsIcon },
  "#/reviews": { label: "Reviews", icon: ReviewsIcon },
} as const;

type Route = keyof typeof ROUTES;

export function App() {
  const [route, setRoute] = useState<string>(window.location.hash || "#/");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const handler = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("krankie-theme", next ? "dark" : "light");
  }

  return (
    <div className="flex h-screen">
      <Sidebar currentRoute={route} dark={dark} onToggleTheme={toggleTheme} />
      <main className="flex-1 overflow-y-auto p-8 bg-background">
        <div className="max-w-7xl mx-auto">
          {renderPage(route)}
        </div>
      </main>
    </div>
  );
}

function renderPage(route: string) {
  switch (route) {
    case "#/":
      return <DashboardPage />;
    case "#/apps":
      return <AppsPage />;
    case "#/keywords":
      return <KeywordsPage />;
    case "#/rankings":
      return <RankingsPage />;
    case "#/research":
      return <ResearchPage />;
    case "#/discover":
      return <DiscoverPage />;
    case "#/competitors":
      return <CompetitorsPage />;
    case "#/ratings":
      return <RatingsPage />;
    case "#/reviews":
      return <ReviewsPage />;
    default:
      return <DashboardPage />;
  }
}

function Sidebar({ currentRoute, dark, onToggleTheme }: { currentRoute: string; dark: boolean; onToggleTheme: () => void }) {
  return (
    <aside
      className="flex w-64 flex-col border-r"
      style={{
        background: dark
          ? "linear-gradient(180deg, var(--color-sidebar) 0%, #0a1120 100%)"
          : "linear-gradient(180deg, var(--color-sidebar) 0%, #f8f8f7 100%)",
        borderColor: dark ? "var(--color-sidebar-border)" : "var(--color-sidebar-border)",
      }}
    >
      {/* Logo area */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full font-bold text-sm text-white"
          style={{
            background: "linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)",
            boxShadow: "0 2px 8px rgba(13, 148, 136, 0.3)",
          }}
        >
          K
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight">Krankie</h1>
          <p className="text-xs text-muted-foreground">ASO Observatory</p>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-4 h-px" style={{ background: dark ? "var(--color-sidebar-border)" : "var(--color-sidebar-border)" }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {(Object.entries(ROUTES) as [Route, (typeof ROUTES)[Route]][]).map(([hash, { label, icon: Icon }]) => {
          const isActive = currentRoute === hash || (hash === "#/" && currentRoute === "");
          return (
            <a
              key={hash}
              href={hash}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              style={isActive ? { boxShadow: "inset 3px 0 0 0 var(--color-primary)" } : undefined}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${!isActive ? "group-hover:scale-110" : ""}`} />
              {label}
            </a>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mx-4 h-px" style={{ background: dark ? "var(--color-sidebar-border)" : "var(--color-sidebar-border)" }} />
      <div className="px-4 py-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-mono">v0.3.0</p>
        <button
          onClick={onToggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

// ============ Simple SVG Icons ============

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  );
}

function AppsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="3" />
      <path d="M6 6h4M6 8h4M6 10h2" />
    </svg>
  );
}

function KeywordsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M14.5 14.5L9.5 9.5" />
    </svg>
  );
}

function RankingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V9M6 14V6M10 14V4M14 14V2" />
    </svg>
  );
}

function RatingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L9.8 5.2L14 5.7L10.9 8.6L11.7 12.8L8 10.8L4.3 12.8L5.1 8.6L2 5.7L6.2 5.2Z" />
    </svg>
  );
}

function ReviewsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v8H5L2 14V3Z" rx="1" />
      <path d="M5 6h6M5 8.5h4" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.3 3.3l1 1M11.7 11.7l1 1M3.3 12.7l1-1M11.7 3.3l1-1" />
    </svg>
  );
}

function ResearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12v9H2V3Z" />
      <path d="M5 6.5h6M5 9h3" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M13.5 14L15 15.5" />
    </svg>
  );
}

function DiscoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M10.5 5.5L9 9l-3.5 1.5L7 7l3.5-1.5Z" />
    </svg>
  );
}

function CompetitorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="5" r="3" />
      <circle cx="11" cy="5" r="3" />
      <path d="M8 11c-3 0-5 1.5-5 3h10c0-1.5-2-3-5-3Z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4.5 4.5 0 0 0 6 6Z" />
    </svg>
  );
}
