// Starts the backend API and the Next.js frontend together. Node built-ins only (no root install).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const apps = [
  { name: "backend", color: "\x1b[35m" },
  { name: "frontend", color: "\x1b[36m" },
];

for (const { name } of apps) {
  if (!existsSync(new URL(`../${name}/node_modules`, import.meta.url))) {
    console.error(
      `Missing ${name}/node_modules. Run \`npm run install:all\` first.`,
    );
    process.exit(1);
  }
}

const children = apps.map(({ name, color }) => {
  const child = spawn(npm, ["--prefix", name, "run", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `${color}[${name}]\x1b[0m ${line}`)
      .join("\n") + "\n";
  child.stdout.on("data", (chunk) => process.stdout.write(prefix(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefix(chunk)));
  child.on("exit", (code) => {
    console.log(`${color}[${name}]\x1b[0m exited with code ${code}`);
    shutdown(code ?? 1);
  });
  return child;
});

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 500).unref();
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
