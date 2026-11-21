import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";
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
  RETREST_DEMO_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  RETREST_SESSION_SECRET: optionalText,
  CARD_WEBHOOK_SECRET: optionalText,
  // Supabase is optional: profile routes answer 503 until it is configured.
  SUPABASE_URL: optionalText,
  SUPABASE_ANON_KEY: optionalText,
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
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
  if (!data.RETREST_SESSION_SECRET && !data.RETREST_DEMO_ENABLED) {
    throw new Error("RETREST_SESSION_SECRET must be configured when the demo is disabled.");
  }
  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    corsOrigins: data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    databasePath:
      data.DATABASE_PATH === ":memory:" || isAbsolute(data.DATABASE_PATH)
        ? data.DATABASE_PATH
        : resolve(BACKEND_ROOT, data.DATABASE_PATH),
    demoEnabled: data.RETREST_DEMO_ENABLED,
    sessionSecret: data.RETREST_SESSION_SECRET ?? DEMO_SESSION_SECRET,
    webhookSecret: data.CARD_WEBHOOK_SECRET,
    supabase: supabaseConfig(data),
  };
}
