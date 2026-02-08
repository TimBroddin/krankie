import React from "react";
import { Box, Text } from "ink";
import { Table } from "../components/Table";
import type { ReviewWithApp } from "../../db";

interface ReviewsProps {
  reviews: ReviewWithApp[];
  selectedIndex: number;
}

export function Reviews({ reviews, selectedIndex }: ReviewsProps): React.ReactElement {
  if (reviews.length === 0) {
    return (
      <Box>
        <Text dimColor>No reviews yet. Run 'krankie reviews fetch' to fetch reviews.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="yellow">
          REVIEWS
        </Text>
        <Text dimColor>  ({reviews.length} shown)</Text>
      </Box>

      <Table
        headers={["Score", "App", "Store", "Title", "Author", "Date"]}
        columnWidths={[7, 15, 6, 30, 12, 12]}
        rows={reviews.map((r, i) => [
          <Stars key="score" score={r.score} bold={i === selectedIndex} />,
          (r.app_name ?? r.app_store_id).slice(0, 13),
          r.store,
          (r.title ?? "").slice(0, 28),
          (r.author ?? "").slice(0, 10),
          r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "-",
        ])}
      />

      {reviews[selectedIndex] && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text bold>{reviews[selectedIndex]!.title ?? "No title"}</Text>
          <Box marginTop={1}>
            <Text wrap="wrap">{reviews[selectedIndex]!.text ?? "No content"}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              {reviews[selectedIndex]!.author ?? "Unknown"} — v{reviews[selectedIndex]!.version ?? "?"} — {reviews[selectedIndex]!.updated_at ? new Date(reviews[selectedIndex]!.updated_at!).toLocaleDateString() : ""}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Stars({ score, bold }: { score: number; bold: boolean }): React.ReactElement {
  const color = score >= 4 ? "green" : score >= 3 ? "yellow" : "red";
  return (
    <Text color={color} bold={bold}>
      {"★".repeat(score)}{"☆".repeat(5 - score)}
    </Text>
  );
}
