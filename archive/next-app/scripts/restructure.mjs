import {
  mkdirSync,
  renameSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
const mapping = {};
function move(from, to) {
  mkdirSync(to.slice(0, to.lastIndexOf("/")), { recursive: true });
  renameSync(from, to);
  mapping[from.replace(/^src\//, "@/").replace(/\.tsx?$/, "")] = to
    .replace(/^src\//, "@/")
    .replace(/\.tsx?$/, "");
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
for (const path of files("src/components"))
  move(
    path,
    path.endsWith("landing-page.tsx")
      ? "src/landing/landing-page.tsx"
      : path.endsWith("dashboard-page.tsx")
        ? "src/backend/rendering/dashboard-page.tsx"
        : path.replace("src/components", "src/frontend/components"),
  );
for (const path of files("src/lib"))
  move(
    path,
    path.includes("preview-account")
      ? path.replace("src/lib", "src/frontend/lib")
      : /\/(format|types|navigation)\.ts$/.test(path)
        ? path.replace("src/lib", "src/shared")
        : path.replace("src/lib", "src/backend/lib"),
  );
move("db/schema.sql", "src/backend/database/schema.sql");
move("src/app/globals.css", "src/frontend/styles/globals.css");
for (const path of [...files("src"), ...files("tests")]) {
  if (!/\.(tsx?|mjs)$/.test(path)) continue;
  let value = readFileSync(path, "utf8");
  for (const [from, to] of Object.entries(mapping))
    value = value
      .replaceAll(from, to)
      .replaceAll(from.replace("@/", "../src/"), to.replace("@/", "../src/"));
  if (path.includes("/backend/lib/"))
    value = value
      .replaceAll('"./types.ts"', '"../../shared/types.ts"')
      .replaceAll('"./format"', '"../../shared/format"')
      .replaceAll('"./types"', '"../../shared/types"');
  value = value
    .replaceAll('"db/schema.sql"', '"src/backend/database/schema.sql"')
    .replaceAll(
      'import "./globals.css"',
      'import "@/frontend/styles/globals.css"',
    );
  writeFileSync(path, value);
}
for (const path of files("src/app/api")) {
  const target = path.replace("src/app/api", "src/backend/routes");
  const code = readFileSync(path, "utf8");
  const names = [
    ...code.matchAll(
      /export (?:async )?function (GET|POST|PATCH|PUT|DELETE)|export const (runtime|dynamic|maxDuration)/g,
    ),
  ].map((m) => m[1] || m[2]);
  if (names.some((n) => ["runtime", "dynamic", "maxDuration"].includes(n)))
    continue;
  mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  renameSync(path, target);
  writeFileSync(
    path,
    `// Next.js route entrypoint; implementation belongs to the backend.\nexport { ${names.join(", ")} } from "${target.replace("src/", "@/").replace(/\.ts$/, "")}";\n`,
  );
}
