import { parseArgs } from "util";
import { execSync } from "child_process";
import { CONFIG } from "../../config";
import { outputSuccess, outputError } from "../output";

const CRON_MARKER = "# krankie-check";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "install":
      await install(subArgs);
      break;
    case "uninstall":
      await uninstall();
      break;
    case "status":
      await status(subArgs);
      break;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`Usage: krankie cron <install|uninstall|status> [options]

Commands:
  install    Install daily cron job
  uninstall  Remove cron job
  status     Show cron job status

Options:
  --hour <0-23>   Hour to run check (default: random 2-6 AM)
  --json          Output as JSON (status only)
`);
}

function getKrankiePath(): string {
  // Get the path to the krankie CLI
  const bunPath = process.execPath;
  const scriptPath = `${process.cwd()}/src/cli/index.ts`;
  return `${bunPath} ${scriptPath}`;
}

function getCurrentCrontab(): string {
  try {
    return execSync("crontab -l 2>/dev/null", { encoding: "utf-8" });
  } catch {
    return "";
  }
}

function setCrontab(content: string): void {
  const { execSync } = require("child_process");
  const tmpFile = `/tmp/krankie-crontab-${Date.now()}`;
  require("fs").writeFileSync(tmpFile, content);
  execSync(`crontab ${tmpFile}`);
  require("fs").unlinkSync(tmpFile);
}

function getRandomHour(): number {
  const { defaultHourMin, defaultHourMax } = CONFIG.cron;
  return Math.floor(Math.random() * (defaultHourMax - defaultHourMin + 1)) + defaultHourMin;
}

async function install(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      hour: { type: "string" },
    },
    allowPositionals: true,
  });

  let hour: number;
  if (values.hour !== undefined) {
    hour = parseInt(values.hour as string, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      outputError("Hour must be between 0 and 23");
      process.exit(1);
    }
  } else {
    hour = getRandomHour();
  }

  const krankiePath = getKrankiePath();
  const cronLine = `0 ${hour} * * * ${krankiePath} check run >> ${CONFIG.logPath} 2>&1 ${CRON_MARKER}`;

  let crontab = getCurrentCrontab();

  // Remove existing krankie entry if present
  const lines = crontab.split("\n").filter((line) => !line.includes(CRON_MARKER));

  // Add new entry
  lines.push(cronLine);

  // Ensure trailing newline
  crontab = lines.filter((l) => l.trim() !== "").join("\n") + "\n";

  setCrontab(crontab);

  outputSuccess(`Installed cron job to run daily at ${hour}:00`);
  console.log(`  Log file: ${CONFIG.logPath}`);
}

async function uninstall(): Promise<void> {
  let crontab = getCurrentCrontab();

  if (!crontab.includes(CRON_MARKER)) {
    outputError("No krankie cron job found");
    process.exit(1);
  }

  const lines = crontab.split("\n").filter((line) => !line.includes(CRON_MARKER));
  crontab = lines.filter((l) => l.trim() !== "").join("\n");

  if (crontab.trim()) {
    crontab += "\n";
  }

  setCrontab(crontab);

  outputSuccess("Removed krankie cron job");
}

async function status(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const crontab = getCurrentCrontab();
  const cronLine = crontab.split("\n").find((line) => line.includes(CRON_MARKER));

  const installed = !!cronLine;
  let hour: number | null = null;
  let nextRun: string | null = null;

  if (cronLine) {
    // Parse hour from cron line (format: "0 H * * * ...")
    const match = cronLine.match(/^0\s+(\d+)\s+\*/);
    if (match) {
      hour = parseInt(match[1], 10);

      // Calculate next run
      const now = new Date();
      const next = new Date(now);
      next.setHours(hour, 0, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      nextRun = next.toISOString();
    }
  }

  if (values.json) {
    console.log(
      JSON.stringify(
        {
          installed,
          hour,
          nextRun,
          logPath: CONFIG.logPath,
        },
        null,
        2
      )
    );
  } else {
    console.log("Cron status:");
    console.log(`  Installed: ${installed ? "yes" : "no"}`);
    if (installed && hour !== null) {
      console.log(`  Scheduled: daily at ${hour}:00`);
      console.log(`  Next run: ${nextRun ? new Date(nextRun).toLocaleString() : "unknown"}`);
      console.log(`  Log file: ${CONFIG.logPath}`);
    }
  }
}
