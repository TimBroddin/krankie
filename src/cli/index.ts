#!/usr/bin/env bun

const commands = {
  app: () => import("./commands/app"),
  keyword: () => import("./commands/keyword"),
  check: () => import("./commands/check"),
  cron: () => import("./commands/cron"),
  rankings: () => import("./commands/rankings"),
  ratings: () => import("./commands/ratings-cmd"),
  reviews: () => import("./commands/reviews"),
  instructions: () => import("./commands/instructions"),
  info: () => import("./commands/info"),
  tui: () => import("../tui/index"),
  web: () => import("./commands/web"),
};

type Command = keyof typeof commands;

function printHelp(): void {
  console.log(`krankie - AI-first App Store keyword ranking tracker

Usage: krankie <command> [options]

Commands:
  app           Manage tracked apps
  keyword       Manage keywords
  check         Run ranking checks
  cron          Manage scheduled checks
  rankings      Query ranking data
  ratings       View app store ratings
  reviews       Fetch and browse reviews
  instructions  Show agent instructions
  info          Show database info
  tui           Launch dashboard
  web           Start web dashboard

Options:
  --help, -h    Show help
  --json        Output as JSON (where applicable)

Examples:
  krankie app create 6737412117 --name "My App" --platform iphone --own
  krankie app update 6737412117 --own --track-keywords --track-ratings
  krankie app list --own --platform iphone
  krankie keyword add 6737412117 "my keyword" --store us
  krankie keyword list --platform iphone
  krankie check run
  krankie rankings --platform iphone --json
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const command = args[0] as Command;

  if (!(command in commands)) {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'krankie --help' for usage.");
    process.exit(1);
  }

  const commandArgs = args.slice(1);

  try {
    const mod = await commands[command]();
    if ("run" in mod) {
      await mod.run(commandArgs);
    } else if ("default" in mod) {
      await mod.default(commandArgs);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unknown error occurred");
    }
    process.exit(1);
  }
}

main();
