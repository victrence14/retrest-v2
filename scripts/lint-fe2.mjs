import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import ts from 'typescript';
import postcss from 'postcss';

const root = resolve(import.meta.dirname, '..');
const featureRoot = resolve(root, 'archive/next-app/src/features');
const adapters = ['invite-card', 'transaction-history', 'spend-summary', 'account-settings', 'support-chat', 'landing-page'].map(name => resolve(root, `archive/next-app/src/components/${name}.tsx`));
const failures = [];
async function walk(folder) {
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}
const features = await walk(featureRoot);
const landingFiles = (await walk(resolve(root, 'landing-page/src'))).filter(path => /\.(ts|tsx)$/.test(path));
const owned = new Set([...features, ...adapters, ...landingFiles]);

for (const configPath of ['archive/next-app/tsconfig.json', 'landing-page/tsconfig.json']) {
  const path = resolve(root, configPath);
  const config = ts.readConfigFile(path, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(path, '..'));
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noUnusedLocals: true, noUnusedParameters: true, incremental: false });
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    if (!diagnostic.file || !owned.has(resolve(diagnostic.file.fileName))) continue;
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    failures.push(`${relative(root, diagnostic.file.fileName)}:${position.line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }
}

for (const path of [...features.filter(path => path.endsWith('/styles.css')), resolve(root, 'landing-page/src/styles.css')]) {
  const prefix = path.includes('/landing-page/') ? '.landing-pitch' : `.fe2-${relative(featureRoot, path).split('/')[0]}`;
  const sheet = postcss.parse(await readFile(path, 'utf8'), { from: path });
  sheet.walkRules(rule => {
    for (const selector of rule.selectors) {
      if (!selector.trim().startsWith(prefix) || !/^[\s.:[#>+~]|$/.test(selector.trim().slice(prefix.length, prefix.length + 1))) failures.push(`${relative(root, path)}:${rule.source?.start?.line}: unscoped selector ${selector}`);
    }
  });
}

for (const path of features.filter(path => /\.(ts|tsx)$/.test(path))) {
  const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch' && !path.endsWith('/shared/api.ts')) failures.push(`${relative(root, path)}: API requests must use the authenticated feature boundary.`);
    if (path.includes('/insights/') && ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'id' && ts.isStringLiteral(node.right)) failures.push(`${relative(root, path)}: recommendations must not depend on hardcoded IDs.`);
    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`FE2 lint passed: TypeScript diagnostics/unused symbols, ${features.filter(path => path.endsWith('/styles.css')).length + 1} scoped stylesheets, authenticated API boundaries, recommendation IDs.`);
