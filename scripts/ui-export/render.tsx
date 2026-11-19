import { DatabaseSync } from 'node:sqlite';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPage from '../../archive/next-app/src/components/landing-page';
import RetrestApp from '../../archive/next-app/src/components/retrest-app';
import AuthShell from '../../archive/next-app/src/components/auth-shell';
import AuthScreen from '../../archive/next-app/src/components/auth-screen';
import { seedDatabase, dashboard } from '../../archive/next-app/src/lib/db';
import { workspacePages, type WorkspaceSection, type AuthMode } from '../../archive/next-app/src/lib/navigation';

export function renderScreens(schema: string) {
  // The export reads no existing database or environment file. These identities
  // and balances are generated from the original application's demo seed only.
  const db = new DatabaseSync(':memory:');
  const globals = globalThis as typeof globalThis & { retrestDb?: DatabaseSync };
  if (globals.retrestDb) throw new Error('Export requires an isolated demo database.');
  db.exec(schema);
  seedDatabase(db);
  globals.retrestDb = db;
  try {
    const initial = dashboard();
    for (const pool of initial.pools) pool.invite_token = `demo-export-${pool.id}`;
    const screens = [{ id: 'landing', title: 'Marketing landing page', markup: renderToStaticMarkup(<LandingPage />) }];
    for (const section of Object.keys(workspacePages) as WorkspaceSection[]) {
      screens.push({ id: section, title: workspacePages[section].label, markup: renderToStaticMarkup(<RetrestApp initial={initial} section={section} />) });
    }
    for (const mode of ['login', 'signup', 'forgot-password', 'reset-password', 'device-binding'] as AuthMode[]) {
      screens.push({ id: mode, title: mode.split('-').map((word) => word[0]!.toUpperCase() + word.slice(1)).join(' '), markup: renderToStaticMarkup(<AuthShell><AuthScreen mode={mode} /></AuthShell>) });
    }
    return screens;
  } finally { delete globals.retrestDb; db.close(); }
}
