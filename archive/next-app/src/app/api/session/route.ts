import { demoEnabled } from "@/lib/db";
import { sessionToken, trustedMutation } from "@/lib/session";

export async function POST(request: Request) {
  if (!demoEnabled() || !trustedMutation(request)) return Response.json({ error: "Demo session unavailable" }, { status: 403 });
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `retrest_session=${sessionToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` } });
}
