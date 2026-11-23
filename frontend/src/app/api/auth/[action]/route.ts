import { proxyAuth } from "@/lib/api/account-proxy";

export const runtime = "nodejs";
type Context = { params: Promise<{ action: string }> };
async function handle(request: Request, context: Context) {
  return proxyAuth(request, (await context.params).action);
}
export { handle as POST, handle as PATCH };
