import React from "react";
import { Box, Text } from "ink";

interface TableProps {
  headers: string[];
  rows: React.ReactNode[][];
  columnWidths?: number[];
}

export function Table({ headers, rows, columnWidths }: TableProps): React.ReactElement {
  const widths = columnWidths ?? headers.map(() => 0);

  return (
    <Box flexDirection="column">
      <Box>
        {headers.map((header, i) => (
          <Box key={i} width={widths[i] || undefined} marginRight={2}>
            <Text bold color="cyan">
              {header}
            </Text>
          </Box>
        ))}
      </Box>
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {row.map((cell, cellIdx) => (
            <Box key={cellIdx} width={widths[cellIdx] || undefined} marginRight={2}>
              {typeof cell === "string" || typeof cell === "number" ? (
                <Text>{cell}</Text>
              ) : (
                cell
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
