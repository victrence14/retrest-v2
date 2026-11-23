import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SupabaseClients } from "../../src/lib/supabase.ts";

export const identities = {
  one: { id: "11111111-1111-4111-8111-111111111111", email: "one@example.test", session: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  two: { id: "22222222-2222-4222-8222-222222222222", email: "two@example.test", session: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
  agent: { id: "33333333-3333-4333-8333-333333333333", email: "agent@example.test", session: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
  unconfirmed: { id: "44444444-4444-4444-8444-444444444444", email: "unconfirmed@example.test", session: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
  oneNewSession: { id: "11111111-1111-4111-8111-111111111111", email: "one@example.test", session: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
};
export type IdentityName = keyof typeof identities;
type Filter = { column: string; operator: string; value: unknown };
const identifier = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("Unexpected test identifier");
  return '"' + name + '"';
};
function normalized(value: unknown): any {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : String(value);
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalized(entry)]));
  return value;
}

/** Auth is stubbed; all data reads, writes, grants and RPCs execute the real SQL under RLS.
 * This small adapter implements only the PostgREST operations used by the application.
 */
export function postgresClients(pg: PGlite) {
  const errors: unknown[] = [];
  async function execute(role: "anon" | "authenticated" | "service_role", identity: IdentityName | null, sql: string, values: unknown[]) {
    try {
      const data = await pg.transaction(async tx => {
        await tx.exec(`set local role ${role}`);
        const account = identity ? identities[identity] : null;
        await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)",
          [account?.id ?? "", JSON.stringify(account ? { sub: account.id, session_id: account.session } : {})]);
        return (await tx.query(sql, values.map(value => value !== null && typeof value === "object" ? JSON.stringify(value) : value))).rows;
      });
      return { data: normalized(data), error: null };
    } catch (error) {
      errors.push(error);
      return { data: null, error: { code: (error as { code?: string }).code ?? "unknown", message: String(error) } };
    }
  }
  function client(role: "anon" | "authenticated" | "service_role", identity: IdentityName | null = null) {
    return {
      from(table: string) {
        let columns = "*";
        let mutation: { kind: "insert" | "update"; value: Record<string, unknown> } | null = null;
        const filters: Filter[] = [];
        const ordering: string[] = [];
        let limit: number | undefined;
        let cursorFilter: string | null = null;
        let count = false; let head = false;
        const query = {
          select(value = "*", options?: { count?: string; head?: boolean }) {
            columns = value; count = options?.count === "exact"; head = options?.head ?? false; return query;
          },
          eq(column: string, value: unknown) { filters.push({ column, operator: "=", value }); return query; },
          gte(column: string, value: unknown) { filters.push({ column, operator: ">=", value }); return query; },
          lt(column: string, value: unknown) { filters.push({ column, operator: "<", value }); return query; },
          is(column: string, value: unknown) { filters.push({ column, operator: "is", value }); return query; },
          or(value: string) { cursorFilter = value; return query; },
          order(column: string, options?: { ascending?: boolean }) { ordering.push(identifier(column) + (options?.ascending === false ? " desc" : " asc")); return query; },
          limit(value: number) { limit = value; return query; },
          insert(value: Record<string, unknown>) { mutation = { kind: "insert", value }; return query; },
          update(value: Record<string, unknown>) { mutation = { kind: "update", value }; return query; },
          async run(single = false) {
            const values: unknown[] = [];
            const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
            const projection = columns === "*" ? "*" : columns.split(",").map(value => identifier(value.trim())).join(",");
            let sql: string;
            const where = filters.map(filter => filter.operator === "is"
              ? `${identifier(filter.column)} is null` : `${identifier(filter.column)} ${filter.operator} ${bind(filter.value)}`);
            if (cursorFilter) {
              const cursor = /^created_at\.lt\.(.+),and\(created_at\.eq\.(.+),id\.lt\.([A-Za-z0-9_-]+)\)$/.exec(cursorFilter);
              if (!cursor) throw new Error("Unexpected cursor expression");
              where.push(`(created_at < ${bind(cursor[1])} or (created_at = ${bind(cursor[2])} and id < ${bind(cursor[3])}))`);
            }
            if (mutation?.kind === "insert") {
              const entries = Object.entries(mutation.value);
              sql = `insert into public.${identifier(table)} (${entries.map(([key]) => identifier(key)).join(",")})
                values (${entries.map(([, value]) => bind(value)).join(",")}) returning ${projection}`;
            } else if (mutation?.kind === "update") {
              const assignments = Object.entries(mutation.value).map(([key, value]) => `${identifier(key)} = ${bind(value)}`);
              sql = `update public.${identifier(table)} set ${assignments.join(",")}${where.length ? " where " + where.join(" and ") : ""} returning ${projection}`;
            } else {
              sql = `select ${head ? "count(*)::int as count" : projection} from public.${identifier(table)}${where.length ? " where " + where.join(" and ") : ""}`;
              if (!head && ordering.length) sql += " order by " + ordering.join(",");
              if (!head && limit !== undefined) sql += ` limit ${bind(limit)}`;
            }
            const result = await execute(role, identity, sql, values);
            if (result.error) return result;
            if (head) return { data: null, count: result.data[0].count, error: null };
            if (single && result.data.length !== 1) return { data: null, error: { code: "PGRST116" } };
            return { data: single ? result.data[0] : result.data, count: count ? result.data.length : undefined, error: null };
          },
          single() { return query.run(true); },
          then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) { return query.run().then(resolve, reject); },
        };
        return query;
      },
      async rpc(name: string, arguments_: Record<string, unknown> = {}) {
        const entries = Object.entries(arguments_);
        const call = `public.${identifier(name)}(${entries.map(([key], index) => `${identifier(key)} => $${index + 1}`).join(",")})`;
        const values = entries.map(([key, value]) => name === "mark_notifications_read" && key === "p_ids" && Array.isArray(value)
          ? "{" + value.join(",") + "}" : value);
        const result = await execute(role, identity, name === "claim_email_jobs"
          ? `select to_jsonb(j) as value from ${call} j` : `select ${call} as value`, values);
        return result.error ? result : { data: name === "claim_email_jobs" ? result.data.map((row: any) => row.value) : result.data[0]?.value, error: null };
      },
    } as unknown as SupabaseClient;
  }
  const anonymous = client("anon");
  const clients: SupabaseClients = {
    auth: {
      ...anonymous,
      rpc: anonymous.rpc,
      auth: {
        async getUser(token: string) {
          const account = Object.hasOwn(identities, token) ? identities[token as IdentityName] : null;
          return account ? { data: { user: {
            id: account.id, email: account.email, email_confirmed_at: token === "unconfirmed" ? null : "2026-01-01T00:00:00Z",
          } as User }, error: null } : { data: { user: null }, error: { message: "invalid token" } };
        },
      },
    } as unknown as SupabaseClient,
    forUser(token: string) { return client("authenticated", token as IdentityName); },
  };
  return { clients, admin: client("service_role"), errors, forIdentity: (name: IdentityName) => client("authenticated", name) };
}

export async function resetFeatureFixtures(db: PGlite) {
  await db.exec("truncate auth.users, public.email_provider_events cascade");
  for (const name of ["one", "two", "agent", "unconfirmed"] as const) {
    const account = identities[name];
    await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,$3,$4)",
      [account.id, account.email, name === "unconfirmed" ? null : "2026-01-01T00:00:00Z", JSON.stringify({ display_name: name })]);
  }
  await db.query("insert into public.support_agents(user_id) values($1)", [identities.agent.id]);
}
