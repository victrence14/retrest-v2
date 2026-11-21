import { dashboard } from "@/lib/db";
import { requireUser } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  return Response.json(dashboard(auth.userId), {
    headers: { "Cache-Control": "no-store" },
  });
}
