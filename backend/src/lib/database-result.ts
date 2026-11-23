import { HttpError } from "./http.ts";

interface DatabaseError { code?: string }
/** Keep SQL, provider details, and credentials out of public errors. */
export function databaseResult<T>(
  result: { data: T | null; error: DatabaseError | null },
): T {
  if (result.error) {
    const code = result.error.code;
    if (code === "P0002" || code === "PGRST116") throw new HttpError(404, "Resource not found.");
    if (code === "42501") throw new HttpError(403, "This account cannot perform that action.");
    if (code === "23505" || code === "P0001") throw new HttpError(409, "Request conflicts with the current state.");
    if (["23502", "23503", "23514", "22023", "22P02"].includes(code ?? ""))
      throw new HttpError(400, "Invalid request or related resource.");
    throw new HttpError(503, "Account database temporarily unavailable.");
  }
  if (result.data === null) throw new HttpError(404, "Resource not found.");
  return result.data;
}
