import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('migration, repeatable seed and RLS policies execute in PostgreSQL', async () => {
  const db = new PGlite();
  try {
    // Emulate Supabase's existing identity schema/roles, then execute the actual
    // committed SQL against PostgreSQL. No project, keys or network are used.
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth;
      create table auth.users (
        id uuid primary key,
        email text,
        raw_user_meta_data jsonb not null default '{}'
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to authenticated;
    `);
    await db.exec(readFileSync(new URL('../backend/supabase/migrations/20261119000000_initial.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../backend/supabase/migrations/20261120000000_retrest_fintech.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../backend/supabase/migrations/20261120020000_product.sql', import.meta.url), 'utf8'));
    const seed = readFileSync(new URL('../backend/supabase/seed.sql', import.meta.url), 'utf8');
    await db.exec(seed); await db.exec(seed);
    const categories = await db.query<{ count: number }>('select count(*)::int as count from public.subscription_categories');
    assert.equal(categories.rows[0]?.count, 4);
    await db.exec(readFileSync(new URL('../backend/supabase/tests/rls.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../backend/supabase/tests/product-rls.sql', import.meta.url), 'utf8'));
    const profiles = await db.query<{ count: number }>('select count(*)::int as count from public.profiles');
    assert.equal(profiles.rows[0]?.count, 0, 'RLS fixtures roll back cleanly');

    // A direct teammate role has an explicit reference-data policy, but receives
    // no broad application-user or service-role privileges.
    await db.exec(readFileSync(new URL('../backend/supabase/teammate-role.sql.example', import.meta.url), 'utf8'));
    await db.exec('set role teammate_alex');
    const teammateCategories = await db.query<{ count: number }>('select count(*)::int as count from public.subscription_categories');
    assert.equal(teammateCategories.rows[0]?.count, 4);
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
  } finally { await db.close(); }
});
