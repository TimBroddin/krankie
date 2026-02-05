import React from "react";
import { Text } from "ink";

interface RankChangeProps {
  change: number | null;
}

export function RankChange({ change }: RankChangeProps): React.ReactElement {
  if (change === null || change === 0) {
    return <Text dimColor>-</Text>;
  }

  if (change > 0) {
    return <Text color="green">▲ +{change}</Text>;
  }

  return <Text color="red">▼ {change}</Text>;
}
