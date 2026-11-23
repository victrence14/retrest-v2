import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { BACKEND_ROOT, readConfig } from "./config.ts";
import { createApp } from "./app.ts";

// Resolve env relative to this workspace, including when launched from the repository root.
loadEnv({ path: join(BACKEND_ROOT, ".env"), quiet: true });

try {
  const config = readConfig(process.env);
  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.log(`RETREST API listening on http://localhost:${config.port}`);
    if (!config.supabase) console.log("Supabase is not configured; authenticated account APIs answer 503.");
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      app.locals.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to start the API.");
  process.exitCode = 1;
}
