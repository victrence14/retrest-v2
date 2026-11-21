import express, { Router } from "express";
import { z } from "zod";
import { sendError } from "../lib/http.ts";
import type { SupabaseClients } from "../lib/supabase.ts";
import { authContext, requireAuth } from "../middleware/supabase-auth.ts";

const PROFILE_COLUMNS = "id, display_name, created_at, updated_at";
const profilePatch = z.object({ display_name: z.string().trim().max(80) }).strict();

/** Supabase-authenticated account routes (Bearer JWT). Answer 503 until Supabase is configured. */
export function profileRoutes(clients: SupabaseClients | null) {
  const router = Router();
  const paths = ["/me", "/profile"];
  if (!clients) {
    router.use(paths, (_request, response) =>
      sendError(response, 503, "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env."),
    );
    return router;
  }
  router.use(paths, express.json({ limit: "16kb" }), requireAuth(clients));

  router.get("/me", (_request, response) => {
    const { user } = authContext(response);
    response.json({ user: { id: user.id, email: user.email } });
  });

  router.get("/profile", async (_request, response) => {
    const { user, db } = authContext(response);
    const { data, error } = await db.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single();
    if (error) return sendError(response, 503, "Unable to load your profile. Check that the database migration has been applied.");
    response.json({ profile: data });
  });

  router.patch("/profile", async (request, response) => {
    const parsed = profilePatch.safeParse(request.body);
    if (!parsed.success) return sendError(response, 400, "Send only display_name, a string of at most 80 characters.");
    const { user, db } = authContext(response);
    const { data, error } = await db.from("profiles").update(parsed.data).eq("id", user.id).select(PROFILE_COLUMNS).single();
    if (error) return sendError(response, 503, "Unable to save your profile. Please try again.");
    response.json({ profile: data });
  });

  return router;
}
