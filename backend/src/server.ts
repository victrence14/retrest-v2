import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { BACKEND_ROOT, readConfig } from "./config.ts";
import { createApp } from "./app.ts";

// Resolve env relative to this workspace, including when launched from the repository root.
loadEnv({ path: join(BACKEND_ROOT, ".env"), quiet: true });

try {
  const config = readConfig(process.env);
  const server = createApp(config).listen(config.port, () => {
    console.log(`RETREST API listening on http://localhost:${config.port}`);
    if (!config.supabase) console.log("Supabase is not configured; /api/me and /api/profile answer 503.");
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to start the API.");
  process.exitCode = 1;
}
