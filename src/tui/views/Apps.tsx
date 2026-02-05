import React from "react";
import { Box, Text, useInput } from "ink";
import type { App } from "../../db";

interface AppsProps {
  apps: App[];
  keywordCounts: Map<string, number>;
  selectedIndex: number;
  onSelect: (app: App) => void;
}

export function Apps({
  apps,
  keywordCounts,
  selectedIndex,
  onSelect,
}: AppsProps): React.ReactElement {
  useInput((input, key) => {
    if (key.return && apps[selectedIndex]) {
      onSelect(apps[selectedIndex]);
    }
  });

  if (apps.length === 0) {
    return (
      <Box>
        <Text dimColor>No apps tracked. Use 'krankie app create' to add one.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {apps.map((app, i) => (
        <Box key={app.id}>
          <Text inverse={i === selectedIndex}>
            {i === selectedIndex ? ">" : " "} {app.name ?? app.app_id}
          </Text>
          <Text dimColor>
            {"  "}({app.platform}) - {keywordCounts.get(app.app_id) ?? 0} keywords
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate • Enter to view details • Esc to go back</Text>
      </Box>
    </Box>
  );
}
