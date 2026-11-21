import { cp, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const originalApp = join(root, 'archive/next-app');
const temporary = await mkdtemp(join(tmpdir(), 'retrest-fe2-demo-'));
const app = join(temporary, 'archive/next-app');
const evidence = join(root, 'test-results/fe2-pitch');
const originalDatabase = join(originalApp, 'data/retrest.sqlite');
const hash = async path => existsSync(path) ? createHash('sha256').update(await readFile(path)).digest('hex') : null;
const databaseBefore = await hash(originalDatabase);
const webhookSecret = randomBytes(32).toString('hex');
let server, landing;

function run(command, args, cwd, env = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
  });
}
async function freePort() {
  const probe = createServer();
  await new Promise((ready, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', ready); });
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  return port;
}
async function ready(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Test server exited before ${url} was ready.`);
    try { const response = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (response.status < 500) return; } catch { /* Server is starting. */ }
    await new Promise(done => setTimeout(done, 300));
  }
  throw new Error(`Test server did not start: ${url}`);
}
async function stop(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  await new Promise(done => { const timer = setTimeout(() => { child.kill('SIGKILL'); done(); }, 5000); child.once('exit', () => { clearTimeout(timer); done(); }); });
}

try {
  await mkdir(app, { recursive: true }); await mkdir(evidence, { recursive: true });
  // Copy sources/schema only. NEVER copy or mount the user's data/ directory.
  for (const path of ['src', 'public', 'db', 'tests', 'package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs', 'playwright.config.ts', 'AGENTS.md']) {
    const source = join(originalApp, path);
    if (existsSync(source)) await cp(source, join(app, path), { recursive: true });
  }
  await cp(join(root, 'package.json'), join(temporary, 'package.json'));
  await symlink(join(root, 'node_modules'), join(temporary, 'node_modules'), 'dir');
  await symlink(join(originalApp, 'node_modules'), join(app, 'node_modules'), 'dir');
  await writeFile(join(app, '.fe2-disposable'), 'Temporary FE2 verification environment. No user database mounted.\n');

  const harness = join(app, 'src/app/fe2-verification');
  await mkdir(harness, { recursive: true });
  await writeFile(join(harness, 'page.tsx'), `import { dashboard } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Harness from "./harness";
export const dynamic = "force-dynamic";
export default async function Page() { const user = await currentUser(); if (!user) redirect("/shield"); return <Harness initial={dashboard(user)} />; }
`);
  await writeFile(join(harness, 'harness.tsx'), `"use client";
import { useState } from "react";
import type { Dashboard } from "@/lib/types";
import PoolsPage from "@/features/pools/PoolsPage";
import InsightsPage from "@/features/insights/InsightsPage";
import SettingsPage from "@/features/settings/SettingsPage";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import "./styles.css";
export default function Harness({initial}:{initial:Dashboard}) {
  const [data,setData] = useState(initial);
  const [tab,setTab] = useState("Pools");
  const [review,setReview] = useState<string|null>(null);
  const [unread,setUnread] = useState(0);
  return <main className="fe2-verification"><h1>FE2 integration verification</h1><p>Disposable database; production shell mounts are unchanged.</p><nav aria-label="FE2 feature verification">{["Pools","Insights","Settings","Notifications"].map(name => <button key={name} aria-pressed={name===tab} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    {tab==="Pools" && <PoolsPage initialData={data} onStateChange={setData}/>}
    {tab==="Insights" && <InsightsPage data={data} onReviewSubscription={setReview}/>}
    {tab==="Settings" && <SettingsPage user={data.user} onStateChange={setData}/>}
    {tab==="Notifications" && <><span aria-label="Recent unread count">{unread}</span><NotificationCenter initialData={data} onStateChange={setData} onUnreadCountChange={setUnread} onReviewSubscription={setReview}/></>}
    {review && <p role="status">Review requested for {data.subscriptions.find(s=>s.id===review)?.merchant_name}</p>}
  </main>;
}
`);
  await writeFile(join(harness, 'styles.css'), `.fe2-verification{max-width:1140px;margin:0 auto;padding:32px 20px}.fe2-verification>h1{font-size:28px;margin-bottom:8px}.fe2-verification>p{color:var(--muted);margin-bottom:20px}.fe2-verification>nav{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}.fe2-verification>nav button{padding:10px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}.fe2-verification>nav button[aria-pressed=true]{border-color:var(--indigo)}\n`);

  const env = { NEXT_TELEMETRY_DISABLED: '1', RETREST_DEMO_ENABLED: 'true', RETREST_SESSION_SECRET: randomBytes(32).toString('hex'), CARD_WEBHOOK_SECRET: webhookSecret };
  await run('npm', ['run', 'typecheck:product'], root);
  console.log('Building a disposable production app, including test-only FE2 mounts.');
  // Webpack permits the external, already-installed node_modules symlinks in this temp copy.
  await run('npm', ['run', 'build', '--', '--webpack'], app, env);
  await run('npm', ['run', 'tokens:build'], root);
  await run('npm', ['run', 'typecheck', '-w', 'landing-page'], root);
  await run('npm', ['run', 'build', '-w', 'landing-page'], root, { VITE_APP_URL: '' });

  const port = await freePort(), landingPort = await freePort();
  const origin = `http://127.0.0.1:${port}`, landingOrigin = `http://127.0.0.1:${landingPort}`;
  server = spawn(process.execPath, [join(originalApp, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: app, env: { ...process.env, ...env }, stdio: 'inherit' });
  landing = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(landingPort), '--strictPort'], { cwd: join(root, 'landing-page'), env: { ...process.env, VITE_APP_URL: '' }, stdio: 'inherit' });
  await ready(`${origin}/api/state`, server); await ready(landingOrigin, landing);
  const testEnv = { ...env, TEST_ORIGIN: origin, FE2_LANDING_ORIGIN: landingOrigin, FE2_DISPOSABLE_APP: app, FE2_TEST_WEBHOOK_SECRET: webhookSecret, FE2_EVIDENCE_DIR: evidence };
  console.log('Running FE2 desktop/mobile product journeys against the disposable server.');
  await run(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config=playwright.product.config.ts'], root, testEnv);
  console.log('Running the existing demo UI regression suite against the same disposable server.');
  await run('npm', ['run', 'test:ui'], app, testEnv);

  const folders = await readdir(join(root, 'test-results/fe2-product'), { withFileTypes: true });
  for (const project of ['desktop', 'mobile']) {
    const candidate = folders.find(entry => entry.isDirectory() && entry.name.includes('pool-shares') && entry.name.endsWith(`-${project}`));
    if (candidate && existsSync(join(root, 'test-results/fe2-product', candidate.name, 'video.webm'))) await cp(join(root, 'test-results/fe2-product', candidate.name, 'video.webm'), join(evidence, `pool-walkthrough-${project}.webm`));
  }
  await writeFile(join(evidence, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), projects: ['desktop', 'mobile'], database: 'disposable', productionShellMountsChanged: false }, null, 2));
  console.log(`FE2 evidence: ${evidence}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  await stop(server); await stop(landing);
  if (await hash(originalDatabase) !== databaseBefore) { console.error('The original demo database changed during verification. Inspect any concurrent demo activity.'); process.exitCode = 1; }
  else console.log('Original demo database unchanged.');
  console.log(`Disposable app retained for debugging: ${app}`);
}
