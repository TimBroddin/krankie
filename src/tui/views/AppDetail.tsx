import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table";
import { RankChange } from "../components/RankChange";
import type { App, RankingWithKeyword } from "../../db";

interface AppDetailProps {
  app: App;
  rankings: RankingWithKeyword[];
  stores: string[];
  selectedStore: string;
}

export function AppDetail({
  app,
  rankings,
  stores,
  selectedStore,
}: AppDetailProps): React.ReactElement {
  const filteredRankings = rankings.filter((r) => r.store === selectedStore);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>{app.name ?? app.app_id}</Text>
        <Text dimColor> ({app.platform})</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Store: </Text>
        {stores.map((store, i) => (
          <Text key={store}>
            {store === selectedStore ? (
              <Text bold inverse>
                {" "}
                {store}{" "}
              </Text>
            ) : (
              <Text dimColor> {store} </Text>
            )}
            {i < stores.length - 1 && <Text dimColor>|</Text>}
          </Text>
        ))}
      </Box>

      {filteredRankings.length > 0 ? (
        <Table
          headers={["Keyword", "Rank", "Change"]}
          columnWidths={[30, 8, 10]}
          rows={filteredRankings.map((r) => [
            r.keyword,
            r.current_rank ?? "-",
            <RankChange key="change" change={r.rank_change} />,
          ])}
        />
      ) : (
        <Text dimColor>No rankings for this store yet.</Text>
      )}

      <Box marginTop={1}>
        <Text dimColor>Tab to switch store • Esc to go back</Text>
      </Box>
    </Box>
  );
}
