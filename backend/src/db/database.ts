import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BACKEND_ROOT } from "../config.ts";
import { seedDatabase } from "./seed.ts";

const SCHEMA_PATH = join(BACKEND_ROOT, "db/schema.sql");

/** Applies the idempotent schema and connection pragmas. */
export function initializeDatabase(db: DatabaseSync) {
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 200;");
  return db;
}

/** Opens (creating if needed) the SQLite database and seeds the demo account once. */
export function openDatabase(path: string, options: { seed?: boolean } = {}): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = initializeDatabase(new DatabaseSync(path));
  if (options.seed !== false) seedDatabase(db);
  return db;
}

/** Runs `work` inside one IMMEDIATE transaction, rolling back on any error. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* The transaction may already be closed. */ }
    throw error;
  }
}

export { seedDatabase };
