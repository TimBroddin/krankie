import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table";
import { RankChange } from "../components/RankChange";
import type { DbStats, RankingWithKeyword } from "../../db";

interface OverviewProps {
  stats: DbStats;
  movers: RankingWithKeyword[];
}

export function Overview({ stats, movers }: OverviewProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>
          Apps: <Text bold>{stats.appCount}</Text>
          {"    "}
          Keywords: <Text bold>{stats.keywordCount}</Text>
          {"    "}
          Stores: <Text bold>{stats.storeCount}</Text>
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          Last check:{" "}
          {stats.lastCheck
            ? new Date(stats.lastCheck).toLocaleString()
            : "never"}
        </Text>
      </Box>

      {movers.length > 0 ? (
        <Box flexDirection="column">
          <Text bold color="yellow">
            TOP MOVERS (24h)
          </Text>
          <Box marginTop={1}>
            <Table
              headers={["Change", "Keyword", "App", "Store", "Rank"]}
              columnWidths={[8, 20, 15, 6, 12]}
              rows={movers.slice(0, 10).map((m) => [
                <RankChange key="change" change={m.rank_change} />,
                m.keyword,
                m.app_name ?? m.app_store_id,
                m.store,
                `${m.previous_rank ?? "?"} → ${m.current_rank ?? "?"}`,
              ])}
            />
          </Box>
        </Box>
      ) : (
        <Text dimColor>No ranking changes yet. Run a check first.</Text>
      )}
    </Box>
  );
}
