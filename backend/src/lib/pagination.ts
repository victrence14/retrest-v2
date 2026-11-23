import { createHash } from "node:crypto";
import { z } from "zod";
import type { Page } from "../contracts/features.ts";
import { HttpError } from "./http.ts";

const cursorSchema = z.object({
  v: z.literal(1), id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  created_at: z.iso.datetime({ offset: true }), scope: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export function pageScope(userId: string, resource: string, filters: object): string {
  return createHash("sha256").update(JSON.stringify([userId, resource, filters])).digest("hex");
}
export function readCursor(cursor: string | undefined, scope: string) {
  if (!cursor) return null;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    if (parsed.scope !== scope) throw new Error();
    // PostgreSQL timestamps retain microseconds. JavaScript Date truncates them,
    // which would skip records between pages and break timestamp tie-breakers.
    return { id: parsed.id, created_at: parsed.created_at };
  } catch { throw new HttpError(400, "Invalid cursor for these filters."); }
}
export function page<T extends { id: string; created_at: string }>(rows: T[], limit: number, scope: string): Page<T> {
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return {
    data,
    next_cursor: rows.length > limit && last
      ? Buffer.from(JSON.stringify({ v: 1, id: last.id, created_at: last.created_at, scope })).toString("base64url")
      : null,
  };
}
