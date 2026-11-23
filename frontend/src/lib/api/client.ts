/**
 * Browser API client. Every request goes to same-origin `/api/*`, which Next.js
 * proxies to the Express backend, so the signed HttpOnly session cookie travels with it.
 */
export class ApiError extends Error {
  status: number;
  requestId: string | null;
  retryAfter: number | null;
  constructor(message: string, status = 0, requestId: string | null = null, retryAfter: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function apiPath(path: string) {
  if (!path.startsWith("/api/") || /[\\#\r\n]/.test(path)) throw new ApiError("Invalid API destination.");
  return path;
}

async function rejection(response: Response): Promise<ApiError> {
  let message =
    response.status === 401
      ? "Your session has ended. Please log in again."
      : "The server could not confirm this action. Please try again.";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") message = body.error;
  } catch {
    /* Keep the safe message for non-JSON responses. */
  }
  const retry = Number(response.headers.get("Retry-After"));
  return new ApiError(message, response.status, response.headers.get("X-Request-ID"), Number.isFinite(retry) && retry > 0 ? retry : null);
}

let session: Promise<unknown> | null = null;

/**
 * Starts the demo session once per page load; later calls reuse the same request.
 * Only the signed-in workspace calls this. Public pages (invites) never receive a session.
 */
export function ensureSession() {
  session ??= fetch("/api/session", { method: "POST", credentials: "same-origin" })
    .then(async response => {
      if (!response.ok) throw await rejection(response);
      return response;
    })
    .catch(error => { session = null; throw error; });
  return session;
}

export async function requestJson<T>(
  path: string,
  options: { method?: Method; body?: unknown; signal?: AbortSignal; headers?: HeadersInit } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(apiPath(path), {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: options.signal,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) throw await rejection(response);
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("The server returned an unreadable response.");
  }
}

/** Downloads an authenticated document and verifies the server returned the requested type. */
export async function authenticatedFile(
  path: string,
  mime: "application/pdf" | "text/csv",
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(apiPath(path), {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: mime },
    signal,
  });
  if (!response.ok) throw await rejection(response);
  if (response.headers.get("Content-Type")?.split(";")[0]?.trim() !== mime) {
    throw new ApiError("The server did not return the requested document.");
  }
  return response.blob();
}

export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  document.body.append(link);
  link.click();
  link.remove();
  // Allow the browser to finish opening the download before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not confirm the action. Please try again.";
}

export function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
