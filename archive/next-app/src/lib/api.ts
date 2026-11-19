import { currentUser, trustedMutation } from "./session";

export async function requireUser(request: Request, mutation = false) {
  if (mutation && !trustedMutation(request)) return { error: Response.json({ error: "Cross-origin request rejected" }, { status: 403 }) };
  const userId = await currentUser();
  if (!userId) return { error: Response.json({ error: "Session required" }, { status: 401 }) };
  return { userId };
}
export async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
