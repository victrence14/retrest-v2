import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "../contracts/features.ts";
import { databaseResult } from "../lib/database-result.ts";
import { page, pageScope, readCursor } from "../lib/pagination.ts";

export interface PageInput { limit: number; cursor?: string }
/** Shared keyset access. Tables, columns, and filters must come from server code. */
export async function listRecords<T extends { id: string; created_at: string }>(
  db: SupabaseClient, userId: string, table: string, columns: string, input: PageInput,
  filters: Record<string, string | boolean | null> = {},
): Promise<Page<T>> {
  const scope = pageScope(userId, table, filters);
  const cursor = readCursor(input.cursor, scope);
  let query = db.from(table).select(columns);
  for (const [column, value] of Object.entries(filters))
    query = value === null ? query.is(column, null) : query.eq(column, value);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(input.limit + 1);
  const rows = databaseResult(result) as unknown as T[];
  return page(rows, input.limit, scope);
}
