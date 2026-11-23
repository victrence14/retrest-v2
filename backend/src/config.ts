import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";
import { isIP } from "node:net";
import { z } from "zod";

/** Backend workspace root, so relative paths work no matter where the process starts. */
export const BACKEND_ROOT = fileURLToPath(new URL("..", import.meta.url));

const optionalText = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  // Exact browser origins allowed to call the API (the Next.js frontend).
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://127.0.0.1:3000"),
  DATABASE_PATH: z.string().default("data/retrest.sqlite"),
  RETREST_DEMO_ENABLED: z.enum(["true", "false"]).optional(),
  RETREST_SESSION_SECRET: optionalText,
  CARD_WEBHOOK_SECRET: optionalText,
  // Supabase is optional: profile routes answer 503 until it is configured.
  SUPABASE_URL: optionalText,
  SUPABASE_ANON_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  TRUST_PROXY: z.string().default("loopback"),
  AUTH_REDIRECT_URL: z.url().default("http://localhost:3000/login"),
  AUTH_RECOVERY_REDIRECT_URL: z.url().default("http://localhost:3000/reset-password"),
  SUPPORT_ENABLED: z.enum(["true", "false"]).default("true"),
  SETTLEMENT_WEBHOOK_SECRET: optionalText,
  EMAIL_PROVIDER: z.enum(["disabled", "resend"]).default("disabled"),
  MONTHLY_EMAIL_SCHEDULING_ENABLED: z.enum(["true", "false"]).default("true"),
  RESEND_API_KEY: optionalText,
  EMAIL_FROM: optionalText,
  RESEND_WEBHOOK_SECRET: optionalText,
});

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface Config {
  nodeEnv: "development" | "test" | "production";
  port: number;
  corsOrigins: string[];
  databasePath: string;
  demoEnabled: boolean;
  sessionSecret: string;
  webhookSecret?: string;
  supabase: SupabaseConfig | null;
  trustProxy?: string[] | false;
  authRedirectUrl?: string;
  authRecoveryRedirectUrl?: string;
  supportEnabled?: boolean;
  settlementWebhookSecret?: string;
  email?: { provider: "resend"; apiKey: string; from: string; webhookSecret?: string } | null;
  monthlyEmailSchedulingEnabled?: boolean;
}

const DEMO_SESSION_SECRET = "retrest-local-demo-session-only";

function supabaseConfig(env: z.infer<typeof envSchema>): SupabaseConfig | null {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = env;
  if (!url || !anonKey || url.includes("your-project") || anonKey.startsWith("your-")) return null;
  if (!z.url().safeParse(url).success) throw new Error("Set SUPABASE_URL in backend/.env to a valid URL.");
  return { url, anonKey, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Report variable names only; never log credentials through validation errors.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Set valid ${fields.join(", ")} values in backend/.env (see backend/.env.example).`);
  }
  const data = result.data;
  const demoEnabled = data.RETREST_DEMO_ENABLED === undefined
    ? data.NODE_ENV !== "production" : data.RETREST_DEMO_ENABLED === "true";
  const supabase = supabaseConfig(data);
  if (data.NODE_ENV === "production" && demoEnabled &&
    (!data.RETREST_SESSION_SECRET || data.RETREST_SESSION_SECRET.length < 32 || data.RETREST_SESSION_SECRET.startsWith("replace-"))) {
    throw new Error("Set a random RETREST_SESSION_SECRET of at least 32 characters for a hosted demo.");
  }
  if (data.NODE_ENV === "production" && !demoEnabled && !supabase) {
    throw new Error("Configure SUPABASE_URL and SUPABASE_ANON_KEY for the account API.");
  }
  const corsOrigins = data.CORS_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean);
  if (corsOrigins.some(origin => {
    try { const url = new URL(origin); return !["http:", "https:"].includes(url.protocol) || url.origin !== origin; }
    catch { return true; }
  })) throw new Error("CORS_ORIGINS must contain exact HTTP(S) origins without paths.");
  const trustProxy = data.TRUST_PROXY === "false" ? false : data.TRUST_PROXY.split(",").map(value => value.trim());
  if (trustProxy && trustProxy.some(value => {
    if (["loopback", "linklocal", "uniquelocal"].includes(value)) return false;
    const [address, prefix] = value.split("/");
    const family = isIP(address);
    return !family || (prefix !== undefined && (!/^\d+$/.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)));
  })) throw new Error("TRUST_PROXY must be false, a named subnet, or explicit proxy IP addresses/CIDRs.");
  if (data.SETTLEMENT_WEBHOOK_SECRET &&
    (data.SETTLEMENT_WEBHOOK_SECRET.length < 32 || !supabase?.serviceRoleKey)) {
    throw new Error("Settlement webhooks require a 32-character SETTLEMENT_WEBHOOK_SECRET and a Supabase service role.");
  }
  if (data.EMAIL_PROVIDER === "resend" && (!data.RESEND_API_KEY || !data.EMAIL_FROM || !supabase?.serviceRoleKey)) {
    throw new Error("Resend requires RESEND_API_KEY, EMAIL_FROM, and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    corsOrigins,
    databasePath:
      data.DATABASE_PATH === ":memory:" || isAbsolute(data.DATABASE_PATH)
        ? data.DATABASE_PATH
        : resolve(BACKEND_ROOT, data.DATABASE_PATH),
    demoEnabled,
    sessionSecret: data.RETREST_SESSION_SECRET ?? DEMO_SESSION_SECRET,
    webhookSecret: data.CARD_WEBHOOK_SECRET,
    supabase,
    trustProxy,
    authRedirectUrl: data.AUTH_REDIRECT_URL,
    authRecoveryRedirectUrl: data.AUTH_RECOVERY_REDIRECT_URL,
    supportEnabled: data.SUPPORT_ENABLED === "true",
    settlementWebhookSecret: data.SETTLEMENT_WEBHOOK_SECRET,
    monthlyEmailSchedulingEnabled: data.MONTHLY_EMAIL_SCHEDULING_ENABLED === "true",
    email: data.EMAIL_PROVIDER === "resend" ? {
      provider: "resend", apiKey: data.RESEND_API_KEY!, from: data.EMAIL_FROM!, webhookSecret: data.RESEND_WEBHOOK_SECRET,
    } : null,
  };
}
