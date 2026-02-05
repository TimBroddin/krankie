import React from "react";
import { Box, Text } from "ink";

export interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
}

export function Tabs({ tabs, activeTab }: TabsProps): React.ReactElement {
  return (
    <Box>
      {tabs.map((tab, i) => (
        <Box key={tab.id} marginRight={1}>
          {tab.id === activeTab ? (
            <Text bold inverse>
              {" "}
              {tab.label}{" "}
            </Text>
          ) : (
            <Text dimColor> {tab.label} </Text>
          )}
          {i < tabs.length - 1 && <Text dimColor> </Text>}
        </Box>
      ))}
    </Box>
  );
}
