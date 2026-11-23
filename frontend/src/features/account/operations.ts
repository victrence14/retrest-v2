/** Persist only operation identifiers and payload digests, never credentials or message text. */
export interface PendingOperation { key: string; fingerprint: string; id?: string }
const memory = new Map<string, PendingOperation>();
const storageName = (userId: string, scope: string) => `retrest.account.operation.${userId}.${scope}`;

export function readAccountOperation(userId: string, scope: string): PendingOperation | null {
  const name = storageName(userId, scope);
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(name) ?? "null");
    if (stored && typeof stored === "object" && "key" in stored && "fingerprint" in stored
      && typeof stored.key === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(stored.key)
      && typeof stored.fingerprint === "string" && /^[a-f0-9]{64}$/.test(stored.fingerprint)) {
      const value: PendingOperation = { key: stored.key, fingerprint: stored.fingerprint };
      if ("id" in stored && typeof stored.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(stored.id)) value.id = stored.id;
      memory.set(name, value);
      return value;
    }
  } catch { /* Private browsers may deny storage; retain retry keys for this page. */ }
  return memory.get(name) ?? null;
}

export function rememberAccountOperation(userId: string, scope: string, operation: PendingOperation) {
  const name = storageName(userId, scope);
  memory.set(name, operation);
  try { localStorage.setItem(name, JSON.stringify(operation)); } catch { /* In-memory retry remains available. */ }
}

export async function beginAccountOperation(userId: string, scope: string, payload: unknown = {}): Promise<PendingOperation> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
  const fingerprint = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
  const previous = readAccountOperation(userId, scope);
  if (previous?.fingerprint === fingerprint) return previous;
  const operation = { key: crypto.randomUUID(), fingerprint };
  rememberAccountOperation(userId, scope, operation);
  return operation;
}

export function finishAccountOperation(userId: string, scope: string, key: string) {
  if (readAccountOperation(userId, scope)?.key !== key) return;
  const name = storageName(userId, scope);
  memory.delete(name);
  try { localStorage.removeItem(name); } catch { /* Storage is optional. */ }
}
