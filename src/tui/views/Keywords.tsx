import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table";
import { RankChange } from "../components/RankChange";
import type { RankingWithKeyword } from "../../db";

export type SortField = "rank" | "keyword" | "store" | "app" | "change";

const SORT_FIELDS: SortField[] = ["rank", "keyword", "store", "app", "change"];

interface KeywordsProps {
  rankings: RankingWithKeyword[];
  selectedIndex: number;
  sortField?: SortField;
  sortDesc?: boolean;
}

function sortRankings(
  rankings: RankingWithKeyword[],
  field: SortField,
  desc: boolean
): RankingWithKeyword[] {
  const sorted = [...rankings].sort((a, b) => {
    switch (field) {
      case "rank": {
        // Nulls (unranked) always at bottom
        if (a.current_rank === null && b.current_rank === null) return 0;
        if (a.current_rank === null) return 1;
        if (b.current_rank === null) return -1;
        return a.current_rank - b.current_rank;
      }
      case "keyword":
        return a.keyword.localeCompare(b.keyword);
      case "store":
        return a.store.localeCompare(b.store) || a.keyword.localeCompare(b.keyword);
      case "app": {
        const aName = a.app_name ?? a.app_store_id;
        const bName = b.app_name ?? b.app_store_id;
        return aName.localeCompare(bName) || a.keyword.localeCompare(b.keyword);
      }
      case "change": {
        const aChange = Math.abs(a.rank_change ?? 0);
        const bChange = Math.abs(b.rank_change ?? 0);
        return bChange - aChange; // Biggest movers first by default
      }
    }
  });

  // For rank and change, "desc" means reversed from default
  // For keyword/store/app, desc means Z-A
  if (desc && field !== "rank" && field !== "change") {
    sorted.reverse();
  } else if (desc && (field === "rank" || field === "change")) {
    sorted.reverse();
  }

  return sorted;
}

export function nextSortField(current: SortField): SortField {
  const idx = SORT_FIELDS.indexOf(current);
  return SORT_FIELDS[(idx + 1) % SORT_FIELDS.length]!;
}

export function Keywords({ rankings, selectedIndex, sortField = "rank", sortDesc = false }: KeywordsProps): React.ReactElement {
  if (rankings.length === 0) {
    return (
      <Box>
        <Text dimColor>No keywords tracked. Use 'krankie keyword add' to add one.</Text>
      </Box>
    );
  }

  const sorted = sortRankings(rankings, sortField, sortDesc);
  const arrow = sortDesc ? "▼" : "▲";

  const headerLabels: Record<string, SortField | null> = {
    "": null,
    "Keyword": "keyword",
    "Store": "store",
    "App": "app",
    "Rank": "rank",
    "Change": "change",
  };

  const headers = Object.keys(headerLabels).map((label) => {
    const field = headerLabels[label];
    if (field === sortField) return `${label} ${arrow}`;
    return label;
  });

  return (
    <Box flexDirection="column">
      <Table
        headers={headers}
        columnWidths={[2, 20, 6, 15, 8, 10]}
        rows={sorted.map((r, i) => [
          i === selectedIndex ? <Text inverse key="sel">{">"}</Text> : " ",
          r.keyword,
          r.store,
          r.app_name ?? r.app_store_id,
          r.current_rank ?? "-",
          <RankChange key="change" change={r.rank_change} />,
        ])}
      />
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate | s: sort ({sortField}) | S: reverse</Text>
      </Box>
    </Box>
  );
}
