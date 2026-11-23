// Build a private frontend snapshot and test real Next/Express routes with disposable databases.
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, symlink } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("..", import.meta.url));
const children = new Set();
let stopping = false;
function stop() {
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const env = { ...process.env, PATH: dirname(process.execPath) + ":" + process.env.PATH, NEXT_TELEMETRY_DISABLED: "1" };
// Exercise the default direct-host configuration; an APP_ORIGIN override hid a login regression.
delete env.APP_ORIGIN;
function launch(command, args, cwd, overrides = {}) {
  const child = spawn(command, args, { cwd, env: { ...env, ...overrides }, stdio: "inherit" });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}
async function run(command, args, cwd, overrides = {}) {
  const child = launch(command, args, cwd, overrides);
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}
async function port() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function ready(url, child) {
  const deadline = Date.now() + 60_000;
  while (!stopping && child.exitCode === null && Date.now() < deadline) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return; } catch { /* Starting. */ }
    await delay(300);
  }
  throw new Error(`Test server did not become ready: ${url}`);
}
try {
  const scratch = await mkdtemp(join(tmpdir(), "retrest-browser-"));
  const frontend = join(scratch, "frontend");
  await mkdir(frontend);
  for (const entry of ["src", "public", "package.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs"])
    await cp(join(root, "frontend", entry), join(frontend, entry), { recursive: true });
  await cp(join(root, "shared"), join(scratch, "shared"), { recursive: true });
  await cp(join(root, "tsconfig.base.json"), join(scratch, "tsconfig.base.json"));
  await symlink(join(root, "frontend/node_modules"), join(frontend, "node_modules"), "dir");
  const backendPort = await port();
  const frontendPort = await port();
  const origin = `http://localhost:${frontendPort}`;
  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const controlSecret = randomBytes(32).toString("hex");
  const backend = launch(process.execPath, [join(root, "backend/node_modules/tsx/dist/cli.mjs"), "scripts/browser-fixture.ts"], join(root, "backend"), {
    RETREST_TEST_BACKEND_PORT: String(backendPort), RETREST_TEST_CONTROL_SECRET: controlSecret,
    RETREST_TEST_FRONTEND_ORIGIN: origin,
  });
  await ready(backendUrl + "/api/health", backend);
  await run("npm", ["run", "build"], frontend, { API_URL: backendUrl });
  const next = launch(process.execPath, [join(root, "frontend/node_modules/next/dist/bin/next"), "start", "--hostname", "0.0.0.0", "--port", String(frontendPort)], frontend, { API_URL: backendUrl });
  await ready(origin + "/login", next);
  await run(process.execPath, [join(root, "frontend/node_modules/playwright/cli.js"), "test", ...process.argv.slice(2)], join(root, "frontend"), {
    TEST_ORIGIN: origin, RETREST_RUN_ACCOUNT_INTEGRATION: "true", RETREST_TEST_BACKEND_URL: backendUrl,
    RETREST_TEST_CONTROL_SECRET: controlSecret,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Browser verification failed.");
  process.exitCode = 1;
} finally {
  stop();
}
