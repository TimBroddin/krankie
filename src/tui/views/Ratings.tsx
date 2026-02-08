import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table";
import type { RatingWithChange } from "../../db";

interface RatingsProps {
  ratings: RatingWithChange[];
  selectedIndex: number;
}

export function Ratings({ ratings, selectedIndex }: RatingsProps): React.ReactElement {
  if (ratings.length === 0) {
    return (
      <Box>
        <Text dimColor>No ratings data yet. Run 'krankie check run' to fetch ratings.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">
          APP RATINGS
        </Text>
        <Text dimColor>  ({ratings.length} entries)</Text>
      </Box>

      <Table
        headers={["App", "Store", "Score", "Change", "Ratings", "★5", "★4", "★3", "★2", "★1"]}
        columnWidths={[18, 6, 7, 8, 10, 7, 7, 7, 7, 7]}
        rows={ratings.map((r, i) => [
          <Text key="app" bold={i === selectedIndex}>
            {(r.app_name ?? r.app_store_id).slice(0, 16)}
          </Text>,
          r.store,
          r.score?.toFixed(1) ?? "-",
          <ScoreChange key="change" change={r.score_change} />,
          r.ratings_count?.toLocaleString() ?? "-",
          String(r.stars_5 ?? "-"),
          String(r.stars_4 ?? "-"),
          String(r.stars_3 ?? "-"),
          String(r.stars_2 ?? "-"),
          String(r.stars_1 ?? "-"),
        ])}
      />
    </Box>
  );
}

function ScoreChange({ change }: { change: number | null }): React.ReactElement {
  if (change === null || change === 0) return <Text dimColor>-</Text>;
  if (change > 0) return <Text color="green">▲ +{change.toFixed(2)}</Text>;
  return <Text color="red">▼ {change.toFixed(2)}</Text>;
}
