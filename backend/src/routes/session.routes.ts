import { Router } from "express";
import type { AppContext } from "../context.ts";
import { dashboardFor } from "../context.ts";
import { sendError } from "../lib/http.ts";
import { currentUser, requireSession, sessionUser } from "../middleware/session.ts";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionToken } from "../services/session.ts";
import { DEMO_USER_ID } from "../constants.ts";

export function sessionRoutes(context: AppContext) {
  const { config } = context;
  const router = Router();

  // Issues the signed demo session cookie (HttpOnly, SameSite=Lax).
  router.post("/session", (request, response) => {
    if (!config.demoEnabled) return sendError(response, 403, "Demo session unavailable");
    response.cookie(SESSION_COOKIE, sessionToken(config.sessionSecret), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS * 1000,
      secure: request.secure,
    });
    response.json({ ok: true });
  });

  // The workspace snapshot the dashboard polls.
  router.get("/state", requireSession(config), (_request, response) => {
    response.json(dashboardFor(context, sessionUser(response)));
  });

  // First server render: the session's workspace, or the public demo workspace before a session exists.
  router.get("/bootstrap", (request, response) => {
    const userId = currentUser(config, request) ?? (config.demoEnabled ? DEMO_USER_ID : null);
    if (!userId) return sendError(response, 401, "The demo is disabled. Account authentication connects in the next phase.");
    response.json(dashboardFor(context, userId));
  });

  return router;
}
