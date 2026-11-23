import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

/** Execute the committed migrations in real PostgreSQL without network or credentials. */
export async function createTestPostgres() {
  const db = new PGlite({
    // Match PostgREST's ISO timestamp strings without losing PostgreSQL microseconds.
    parsers: { 1184: value => value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00") },
  });
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth;
      create table auth.users (
        id uuid primary key, email text, email_confirmed_at timestamptz,
        raw_user_meta_data jsonb not null default '{}'
      );
      create function auth.uid() returns uuid language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
      $$;
      create function auth.jwt() returns jsonb language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;
      grant usage on schema auth to authenticated, service_role;
    `);
    const directory = new URL("../../supabase/migrations/", import.meta.url);
    for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort())
      await db.exec(readFileSync(new URL(name, directory), "utf8"));
    return db;
  } catch (error) { await db.close(); throw error; }
}
