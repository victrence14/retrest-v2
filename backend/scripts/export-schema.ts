import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const directory = new URL("../supabase/", import.meta.url);
const migrations = readdirSync(new URL("migrations/", directory)).filter(name => name.endsWith(".sql")).sort();
const versions = migrations.map(name => name.split("_")[0]);
const content = migrations.map(name => `-- Source: migrations/${name}\n\n${
  readFileSync(new URL(`migrations/${name}`, directory), "utf8").replace(/^begin;\s*/i, "").replace(/\s*commit;\s*$/i, "")
}`).join("\n\n");
writeFileSync(new URL("schema.sql", directory), `-- RETREST: complete Supabase schema for a NEW project only.
-- Generated from all versioned migrations and the category seed.
-- Existing projects must apply only their missing migrations; this export is not an upgrade script.
-- Supabase provides auth.users, auth.uid(), auth.jwt(), and the API roles.
-- Auth redirects, SMTP, password policy, and email confirmation are configured in its dashboard.
-- After a SQL Editor installation, record only the versions actually applied with:
-- npx supabase migration repair --remote --status applied ${versions.join(" ")}

begin;

${content}

-- Source: seed.sql
${readFileSync(new URL("seed.sql", directory), "utf8")}
commit;

select public.backend_readiness() as schema_revision;
`);
console.log("Updated the complete Supabase schema export.");
