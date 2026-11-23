import type { ErrorRequestHandler, Request, Response } from "express";

/** A JSON object body, or null when the body is missing, malformed, or not an object. */
export function objectBody(request: Request): Record<string, unknown> | null {
  const value: unknown = request.body;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function sendError(response: Response, status: number, error: string) {
  response.status(status).json({ error });
}

/** Malformed JSON becomes an empty body so each route returns its own validation message. */
export const tolerateMalformedJson: ErrorRequestHandler = (error, request, _response, next) => {
  if (error?.type === "entity.parse.failed") {
    request.body = undefined;
    next();
    return;
  }
  next(error);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  if (response.headersSent) return next(error);
  if (error instanceof HttpError) return sendError(response, error.status, error.message);
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 500;
  if (status === 413) return sendError(response, 413, "Payload too large");
  const safeStatus = status >= 400 && status < 500 ? status : 500;
  if (safeStatus === 500) console.error(JSON.stringify({ event: "request_error", request_id: response.locals.requestId, method: request.method }));
  sendError(response, safeStatus, safeStatus === 500 ? "An unexpected server error occurred." : "Invalid request.");
};

/** Thrown inside a route (often mid-transaction) to abort with a specific client response. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Sends an HttpError as-is; anything else becomes `status` with the route's safe `fallback` message. */
export function sendFailure(response: Response, error: unknown, fallback: string, status = 500) {
  if (error instanceof HttpError) return sendError(response, error.status, error.message);
  console.error(error);
  sendError(response, status, fallback);
}
