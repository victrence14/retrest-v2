import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeChoice = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';
const storageKey = 'retrest.theme';
const ThemeContext = createContext<{ choice: ThemeChoice; theme: Theme; setChoice: (choice: ThemeChoice) => void } | null>(null);

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch { return 'system'; }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [system, setSystem] = useState<Theme>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const theme = choice === 'system' ? system : choice;

  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const syncSystem = () => setSystem(query.matches ? 'dark' : 'light');
    const syncStorage = (event: StorageEvent) => { if (event.key === storageKey || event.key === null) setChoiceState(readChoice()); };
    query.addEventListener('change', syncSystem);
    window.addEventListener('storage', syncStorage);
    syncSystem();
    return () => { query.removeEventListener('change', syncSystem); window.removeEventListener('storage', syncStorage); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent);
  }, [theme]);

  const setChoice = (next: ThemeChoice) => {
    setChoiceState(next);
    try {
      if (next === 'system') localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, next);
    } catch { /* The current tab still works without persistent storage. */ }
  };

  return <ThemeContext.Provider value={{ choice, theme, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context;
}

export function ThemeControl() {
  const { choice, theme, setChoice } = useTheme();
  return <div className="theme-control">
    <button className="button button-quiet" type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setChoice(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? '☀' : '☾'} <span>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
    </button>
    <label className="sr-only" htmlFor="theme-preference">Theme preference</label>
    <select id="theme-preference" value={choice} onChange={(event) => setChoice(event.target.value as ThemeChoice)}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </div>;
}
