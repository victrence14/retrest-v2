import type { Request, RequestHandler, Response } from "express";
import type { Config } from "../config.ts";
import { readCookie } from "../lib/cookies.ts";
import { sendError } from "../lib/http.ts";
import { SESSION_COOKIE, verifySession } from "../services/session.ts";

/** The signed-in user id that requireSession stored on the response. */
export function sessionUser(response: Response): string {
  const userId = response.locals.userId as string | undefined;
  if (!userId) throw new Error("A protected route is missing requireSession middleware.");
  return userId;
}

export function currentUser(config: Config, request: Request): string | null {
  if (!config.demoEnabled) return null;
  return verifySession(config.sessionSecret, readCookie(request.headers.cookie, SESSION_COOKIE));
}

/**
 * CSRF defence for cookie-authenticated mutations: reject cross-site browser requests
 * and any Origin that is not this API, the proxying frontend, or an allow-listed origin.
 */
export function isTrustedMutation(config: Config, request: Request): boolean {
  if (request.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.get("origin");
  if (!origin) return true;
  const trusted = new Set(config.corsOrigins);
  trusted.add(`${request.protocol}://${request.get("host")}`);
  return trusted.has(origin);
}

export function requireTrustedOrigin(config: Config): RequestHandler {
  return (request, response, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method) || isTrustedMutation(config, request)) return next();
    sendError(response, 403, "Cross-origin request rejected");
  };
}

export function requireSession(config: Config): RequestHandler {
  return (request, response, next) => {
    const userId = currentUser(config, request);
    if (!userId) return sendError(response, 401, "Session required");
    response.locals.userId = userId;
    next();
  };
}

export function requireDemo(config: Config, message: string): RequestHandler {
  return (_request, response, next) => (config.demoEnabled ? next() : sendError(response, 403, message));
}
