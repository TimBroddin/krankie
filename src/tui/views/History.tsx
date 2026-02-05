import React from "react";
import { Box, Text } from "ink";
import type { DbStats } from "../../db";

interface HistoryProps {
  stats: DbStats;
  recentLogs: string[];
}

export function History({ stats, recentLogs }: HistoryProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Recent Activity
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Total rankings recorded: <Text bold>{stats.rankingCount}</Text>
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          Last check:{" "}
          <Text bold>
            {stats.lastCheck
              ? new Date(stats.lastCheck).toLocaleString()
              : "never"}
          </Text>
        </Text>
      </Box>

      {recentLogs.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Check Log:</Text>
          {recentLogs.map((log, i) => (
            <Text key={i} dimColor>
              {log}
            </Text>
          ))}
        </Box>
      ) : (
        <Text dimColor>No check logs yet.</Text>
      )}
    </Box>
  );
}
