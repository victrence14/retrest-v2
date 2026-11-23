import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createTestPostgres } from "./helpers/postgres.ts";

test("migration, repeatable seed and RLS policies execute in PostgreSQL", async () => {
  const db = await createTestPostgres();
  try {
    // Emulate Supabase's existing identity schema/roles, then execute the actual
    // committed SQL against PostgreSQL. No project, keys or network are used.
    const seed = readFileSync(
      new URL("../supabase/seed.sql", import.meta.url),
      "utf8",
    );
    await db.exec(seed);
    await db.exec(seed);
    const categories = await db.query<{ count: number }>(
      "select count(*)::int as count from public.subscription_categories",
    );
    assert.equal(categories.rows[0]?.count, 4);
    await db.exec(
      readFileSync(
        new URL("../supabase/tests/rls.sql", import.meta.url),
        "utf8",
      ),
    );
    const profiles = await db.query<{ count: number }>(
      "select count(*)::int as count from public.profiles",
    );
    assert.equal(profiles.rows[0]?.count, 0, "RLS fixtures roll back cleanly");

    // A direct teammate role has an explicit reference-data policy, but receives
    // no broad application-user or service-role privileges.
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/teammate-role.sql.example",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role teammate_alex");
    const teammateCategories = await db.query<{ count: number }>(
      "select count(*)::int as count from public.subscription_categories",
    );
    assert.equal(teammateCategories.rows[0]?.count, 4);
    await assert.rejects(
      db.query("select * from public.profiles"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
