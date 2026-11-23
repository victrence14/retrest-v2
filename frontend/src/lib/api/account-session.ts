import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountCookieNames } from "./account-proxy";

/** Rendering gate only. Express verifies identity, session revocation and RLS on every API request. */
export async function requireAccountCookie(destination: string) {
  const jar = await cookies();
  const names = accountCookieNames();
  if (!jar.get(names.access)?.value && !jar.get(names.refresh)?.value)
    redirect(`/login?next=${encodeURIComponent(destination)}`);
}
