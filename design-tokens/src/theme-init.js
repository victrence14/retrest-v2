// Injected before the page renders in both Vite applications.
(() => {
  // Vite supplies token-derived colors so the toolbar matches before React loads.
  const themeColors = __RETREST_THEME_COLORS__;
  let choice = 'system';
  try {
    const saved = localStorage.getItem('retrest.theme');
    if (saved === 'light' || saved === 'dark') choice = saved;
  } catch { /* Storage can be disabled by the browser. */ }
  const theme = choice === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = choice;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[theme]);
})();
