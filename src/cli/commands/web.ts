import { parseArgs } from "util";

export async function run(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      port: { type: "string", default: "6768" },
      open: { type: "boolean", default: false },
      host: { type: "string", default: "localhost" },
    },
    allowPositionals: true,
  });

  const port = parseInt(values.port as string, 10);
  const host = values.host as string;

  // Dynamic import to avoid loading web dependencies for other commands
  const { startServer } = await import("../../web/server");

  const { server, port: actualPort } = startServer(port);

  const url = `http://${host}:${actualPort}`;
  console.log(`\n  🔮 Krankie web UI running at ${url}\n`);
  console.log(`  Press Ctrl+C to stop\n`);

  if (values.open) {
    // Open browser (macOS)
    const proc = Bun.spawn(["open", url]);
    await proc.exited;
  }

  // Keep the process alive
  await new Promise(() => {});
}
