import React from "react";
import { Badge } from "./ui/badge";
import type { Rating } from "../lib/api";

export function RankChange({ change }: { change: number | null }) {
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

export function TrackingToggle({ label, active, onClick, title }: { label: string; active: boolean; onClick: (e: React.MouseEvent) => void; title: string }) {
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

export function RatingCard({ rating }: { rating: Rating }) {
  const histogram = [
    { stars: 5, count: rating.stars_5 ?? 0 },
    { stars: 4, count: rating.stars_4 ?? 0 },
    { stars: 3, count: rating.stars_3 ?? 0 },
    { stars: 2, count: rating.stars_2 ?? 0 },
    { stars: 1, count: rating.stars_1 ?? 0 },
  ];
  const maxCount = Math.max(...histogram.map((h) => h.count), 1);
  const hasHistogram = histogram.some((h) => h.count > 0);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{rating.store.toUpperCase()}</Badge>
          <span className="text-lg font-bold">
            {rating.score != null ? Number(rating.score).toFixed(1) : "--"}
          </span>
          {rating.score_change != null && rating.score_change !== 0 && (
            <span className={`text-xs font-mono ${rating.score_change > 0 ? "text-success" : "text-destructive"}`}>
              {rating.score_change > 0 ? "+" : ""}{rating.score_change.toFixed(2)}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {(rating.ratings_count ?? 0).toLocaleString()} ratings
          {rating.count_change != null && rating.count_change > 0 && (
            <span className="text-success ml-1">(+{rating.count_change})</span>
          )}
        </span>
      </div>
      {hasHistogram && (
        <div className="space-y-1">
          {histogram.map((h) => (
            <div key={h.stars} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-2 text-right">{h.stars}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-warning/70 rounded-full"
                  style={{ width: `${(h.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-10 text-right font-mono">
                {h.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium truncate" title={value}>{value}</p>
    </div>
  );
}
