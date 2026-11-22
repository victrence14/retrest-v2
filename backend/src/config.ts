import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),
  CARD_PROVIDER: z.enum(['sudo', 'mock']).optional(),
  SUDO_API_KEY: z.string().optional(),
  SUDO_BASE_URL: z.string().optional(),
  SUDO_WEBHOOK_SECRET: z.string().optional(),
  SUDO_FUNDING_SOURCE_ID: z.string().optional(),
  FX_NGN_PER_USD: z.coerce.number().positive().optional(),
});

export type CardProvider = 'sudo' | 'mock';
export type Config = z.infer<typeof envSchema>;

export const DEFAULT_FX_NGN_PER_USD = 1535.25;

export function resolveCardProvider(config: Config): CardProvider {
  return config.CARD_PROVIDER === 'sudo' ? 'sudo' : 'mock';
}

export function resolveFxNgnPerUsd(config: Config): number {
  return config.FX_NGN_PER_USD ?? DEFAULT_FX_NGN_PER_USD;
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Report variable names only; never log credentials through validation errors.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Set valid ${fields.join(', ')} values in backend/.env (see backend/.env.example).`);
  }
  if (result.data.SUPABASE_URL.includes('your-project') || result.data.SUPABASE_ANON_KEY.startsWith('your-')) {
    throw new Error('Replace the Supabase placeholders in backend/.env with your development project credentials.');
  }
  return result.data;
}
