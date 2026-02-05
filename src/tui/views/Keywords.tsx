import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table";
import { RankChange } from "../components/RankChange";
import type { RankingWithKeyword } from "../../db";

interface KeywordsProps {
  rankings: RankingWithKeyword[];
  selectedIndex: number;
}

export function Keywords({ rankings, selectedIndex }: KeywordsProps): React.ReactElement {
  if (rankings.length === 0) {
    return (
      <Box>
        <Text dimColor>No keywords tracked. Use 'krankie keyword add' to add one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Table
        headers={["", "Keyword", "Store", "App", "Rank", "Change"]}
        columnWidths={[2, 20, 6, 15, 6, 8]}
        rows={rankings.map((r, i) => [
          i === selectedIndex ? <Text inverse key="sel">{">"}</Text> : " ",
          r.keyword,
          r.store,
          r.app_name ?? r.app_store_id,
          r.current_rank ?? "-",
          <RankChange key="change" change={r.rank_change} />,
        ])}
      />
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate</Text>
      </Box>
    </Box>
  );
}
