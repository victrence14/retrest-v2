import { proxyAccount } from "@/lib/api/account-proxy";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return proxyAccount(request, (await context.params).path);
}
export { handle as GET, handle as HEAD, handle as POST, handle as PATCH, handle as DELETE };
