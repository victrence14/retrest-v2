import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),
});

export type Config = z.infer<typeof envSchema>;

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
