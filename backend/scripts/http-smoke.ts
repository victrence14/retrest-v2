import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import { BACKEND_ROOT, readConfig } from "../src/config.ts";
import { createApp } from "../src/app.ts";

// Explicit configuration ignores local credentials and cannot open a persistent database.
const secret = randomBytes(32).toString("hex");
const app = createApp(readConfig({
  NODE_ENV: "test", DATABASE_PATH: ":memory:", RETREST_DEMO_ENABLED: "true",
  RETREST_SESSION_SECRET: randomBytes(32).toString("hex"), CARD_WEBHOOK_SECRET: secret,
}));
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
try {
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const child = spawn(process.execPath, ["tests/http-smoke.mjs"], {
    cwd: BACKEND_ROOT, stdio: "inherit", env: { ...process.env, TEST_ORIGIN: origin, CARD_WEBHOOK_SECRET: secret },
  });
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  app.locals.close();
}
