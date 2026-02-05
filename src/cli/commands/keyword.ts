import { parseArgs } from "util";
import { addKeyword, listKeywords, deleteKeyword, getAppByAppId, getKeywordById } from "../../db";
import { outputTable, outputSuccess, outputError } from "../output";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case "add":
      await add(subArgs);
      break;
    case "list":
      await list(subArgs);
      break;
    case "delete":
      await remove(subArgs);
      break;
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`Usage: krankie keyword <add|list|delete> [options]

Commands:
  add <app_id> <keyword>  Add keyword to track
  list                    List all keywords
  delete <keyword_id>     Remove a keyword

Options:
  --store <store>   Store code(s), comma-separated (us, gb, de, etc.)
  --app <app_id>    Filter by app
  --json            Output as JSON
`);
}

async function add(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      store: { type: "string", default: "us" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const appId = positionals[0];
  const keyword = positionals.slice(1).join(" ");

  if (!appId) {
    outputError("App ID required");
    process.exit(1);
  }

  if (!keyword) {
    outputError("Keyword required");
    process.exit(1);
  }

  // Verify app exists
  const app = await getAppByAppId(appId);
  if (!app) {
    outputError(`App not found: ${appId}. Add it first with 'krankie app create ${appId}'`);
    process.exit(1);
  }

  // Parse stores (comma-separated)
  const stores = (values.store as string).split(",").map((s) => s.trim().toLowerCase());
  const created: Awaited<ReturnType<typeof addKeyword>>[] = [];

  for (const store of stores) {
    try {
      const kw = await addKeyword(appId, keyword, store);
      created.push(kw);
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        outputError(`Keyword "${keyword}" already exists for ${appId} in ${store}`);
      } else {
        throw error;
      }
    }
  }

  if (values.json) {
    console.log(JSON.stringify(created, null, 2));
  } else if (created.length > 0) {
    outputSuccess(`Added "${keyword}" for ${appId} in: ${created.map((k) => k.store).join(", ")}`);
  }
}

async function list(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      app: { type: "string" },
      store: { type: "string" },
      json: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const keywords = await listKeywords({
    appId: values.app as string | undefined,
    store: values.store as string | undefined,
  });

  if (keywords.length === 0) {
    if (values.json) {
      console.log("[]");
    } else {
      console.log("No keywords tracked. Use 'krankie keyword add <app_id> <keyword> --store us' to add one.");
    }
    return;
  }

  if (values.json) {
    console.log(JSON.stringify(keywords, null, 2));
  } else {
    outputTable(
      ["ID", "Keyword", "Store", "App", "Platform"],
      keywords.map((k) => [k.id, k.keyword, k.store, k.app_name ?? k.app_store_id, k.platform])
    );
  }
}

async function remove(args: string[]): Promise<void> {
  const { positionals } = parseArgs({
    args,
    options: {},
    allowPositionals: true,
  });

  const keywordId = positionals[0];
  if (!keywordId) {
    outputError("Keyword ID required");
    process.exit(1);
  }

  const id = parseInt(keywordId, 10);
  if (isNaN(id)) {
    outputError("Invalid keyword ID");
    process.exit(1);
  }

  // Get keyword info before deleting
  const keyword = await getKeywordById(id);
  const deleted = await deleteKeyword(id);

  if (deleted) {
    outputSuccess(`Deleted keyword: "${keyword?.keyword}" (${keyword?.store})`);
  } else {
    outputError(`Keyword not found: ${keywordId}`);
    process.exit(1);
  }
}
