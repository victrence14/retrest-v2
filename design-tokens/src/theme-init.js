// Injected before the page renders in both Vite applications.
(() => {
  let choice = 'system';
  try {
    const saved = localStorage.getItem('retrest.theme');
    if (saved === 'light' || saved === 'dark') choice = saved;
  } catch { /* Storage can be disabled by the browser. */ }
  document.documentElement.dataset.theme = choice === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;
})();
