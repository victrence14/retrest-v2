let fixture = { offlineReady: false, needRefresh: false };

export function setPwaFixture(next: typeof fixture) { fixture = next; }

// Export-only service-worker state. No worker, browser session or API is loaded.
export function useRegisterSW() {
  return {
    offlineReady: [fixture.offlineReady, () => {}] as const,
    needRefresh: [fixture.needRefresh, () => {}] as const,
    updateServiceWorker: async () => {},
  };
}
