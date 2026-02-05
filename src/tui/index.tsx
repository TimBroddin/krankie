#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import App from "./App";

export default async function run(_args: string[]): Promise<void> {
  // Clear screen and hide cursor for fullscreen experience
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");

  const { waitUntilExit } = render(<App />, {
    exitOnCtrlC: true,
  });

  try {
    await waitUntilExit();
  } finally {
    // Show cursor again when exiting
    process.stdout.write("\x1b[?25h");
    // Clear screen on exit
    process.stdout.write("\x1b[2J\x1b[H");
  }
}

// Allow direct execution
if (import.meta.main) {
  run([]);
}
