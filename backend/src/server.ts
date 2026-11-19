import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { readConfig } from './config.js';
import { createApp } from './app.js';

// Resolve env relative to this workspace, including when launched from the root.
loadEnv({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

try {
  const config = readConfig(process.env);
  const server = createApp(config).listen(config.PORT, () => {
    console.log(`RETREST API listening on http://localhost:${config.PORT}`);
  });
  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to start the API.');
  process.exitCode = 1;
}
