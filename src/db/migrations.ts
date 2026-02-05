import { getDb } from "./schema";

// Migration system for future schema changes
// Currently at version 1, no migrations needed yet

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  const row = db.query("SELECT value FROM metadata WHERE key = 'schema_version'").get() as { value: string } | null;
  const currentVersion = row ? parseInt(row.value, 10) : 0;

  // Add migrations here as needed
  // if (currentVersion < 2) {
  //   db.exec("ALTER TABLE ...");
  //   db.run("UPDATE metadata SET value = '2' WHERE key = 'schema_version'");
  // }

  if (currentVersion === 0) {
    // Fresh install, schema already created
    return;
  }
}

export { getDb, closeDb } from "./schema";
