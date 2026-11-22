/** The restored demo authenticates with its signed HttpOnly session cookie. */
export class FeatureApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "FeatureApiError";
    this.status = status;
  }
}

function localApiPath(path: string) {
  if (!path.startsWith("/api/") || /[\\#\r\n]/.test(path)) {
    throw new FeatureApiError("Invalid API destination.");
  }
  return path;
}

async function rejection(response: Response): Promise<FeatureApiError> {
  let message = response.status === 401
    ? "Your demo session has ended. Open Shield, then try again."
    : "The server could not confirm this action. Please try again.";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      message = body.error;
    }
  } catch { /* Keep the safe error for non-JSON responses. */ }
  return new FeatureApiError(message, response.status);
}

export async function requestJson<T>(path: string, options: {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  signal?: AbortSignal;
} = {}): Promise<T> {
  const response = await fetch(localApiPath(path), {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    signal: options.signal,
    headers: {
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) throw await rejection(response);
  try { return await response.json() as T; }
  catch { throw new FeatureApiError("The server returned an unreadable response."); }
}

export async function authenticatedFile(path: string, mime: "application/pdf" | "text/csv", signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(localApiPath(path), {
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { Accept: mime },
    signal,
  });
  if (!response.ok) throw await rejection(response);
  if (response.headers.get("Content-Type")?.split(";")[0].trim() !== mime) {
    throw new FeatureApiError("The server did not return the requested document.");
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
