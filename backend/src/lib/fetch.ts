/** Bound dependency requests and preserve caller cancellation (including streamed exports). */
export function timeoutFetch(transport: typeof fetch = fetch, timeoutMs = 10_000): typeof fetch {
  return (input, init) => {
    const existing = init?.signal ?? (input instanceof Request ? input.signal : null);
    const timeout = AbortSignal.timeout(timeoutMs);
    return transport(input, { ...init, signal: existing ? AbortSignal.any([existing, timeout]) : timeout });
  };
}
