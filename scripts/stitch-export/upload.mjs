import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackage } from './package.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => !['--upload', '--dry-run'].includes(argument)) || (arguments_.includes('--upload') && arguments_.includes('--dry-run'))) throw new Error('Usage: node upload.mjs [--dry-run | --upload]');
const manifest = validatePackage(root);
const upload = arguments_.includes('--upload');
const documents = [{ path: 'DESIGN.md', title: 'RETREST design system', mime: 'text/markdown' }, ...manifest.screens.map((screen) => ({ path: screen.html, title: screen.title, mime: 'text/html' }))];
console.log(`Verified ${documents.length} reference documents (${manifest.screens.length} HTML screens + DESIGN.md); token SHA-256 ${manifest.tokens_sha256}.`);
if (!upload) {
  console.log('Dry run: no credentials loaded and no network requests made.\nTo upload reference documents to your own existing project, configure .env and run node upload.mjs --upload.');
} else {
  if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
  const project = (process.env.STITCH_PROJECT_ID || '').replace(/^projects\//, '');
  const key = process.env.STITCH_API_KEY;
  if (!key || !/^[a-zA-Z0-9_-]+$/.test(project)) throw new Error('Set STITCH_API_KEY and your existing STITCH_PROJECT_ID in stitch-export/.env or the process environment.');
  if (process.env.STITCH_API_BASE_URL && process.env.STITCH_API_BASE_URL !== 'https://stitch.googleapis.com') throw new Error('Upload only supports the official https://stitch.googleapis.com endpoint.');
  for (const document of documents) {
    const response = await fetch(`https://stitch.googleapis.com/v1/projects/${encodeURIComponent(project)}/screens:batchCreate`, {
      method: 'POST', headers: { 'X-Goog-Api-Key': key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ parent: `projects/${project}`, createScreenInstances: true, requests: [{ screen: {
        title: document.title, screenType: 'DOCUMENT', isCreatedByClient: true,
        generatedBy: document.mime === 'text/markdown' ? 'UserUploadedDesignMd' : 'UserUploadedHtml',
        htmlCode: { fileContentBase64: readFileSync(join(root, document.path)).toString('base64'), mimeType: document.mime },
      } }] }),
    });
    if (!response.ok) throw new Error(`Stitch upload stopped at ${document.path}: HTTP ${response.status}. Review your project before retrying; earlier documents may already exist.`);
    // Do not log credentials or response bodies, or retry ambiguous requests.
    await response.arrayBuffer();
    console.log(`Uploaded reference document: ${document.path}`);
  }
  console.log('Reference upload complete. Open Stitch, attach the design system and prompts, and generate/edit the corresponding designs. Upload creates reference assets; use the Stitch editor to produce editable screens.');
}
