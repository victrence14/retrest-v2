import type { Request, RequestHandler } from "express";

/** Inject an atomic shared implementation (for example Redis) for limits across replicas. */
export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; until: number }>();
  constructor(private readonly now = Date.now, private readonly capacity = 10_000) {}
  async consume(key: string, limit: number, windowMs: number) {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) {
      if (this.buckets.size >= this.capacity) {
        for (const [name, value] of this.buckets) if (value.until <= now) this.buckets.delete(name);
        if (!this.buckets.has(key) && this.buckets.size >= this.capacity)
          return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      }
      bucket = { count: 0, until: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.until - now) / 1000)) };
  }
}
export function rateLimit(store: RateLimitStore, namespace: string, limit: number, windowMs: number,
  key: (request: Request) => string = request => request.ip ?? "unknown"): RequestHandler {
  return async (request, response, next) => {
    const result = await store.consume(`${namespace}:${key(request)}`, limit, windowMs);
    if (result.allowed) return next();
    response.set("Retry-After", String(result.retryAfterSeconds)).status(429).json({ error: "Too many requests. Try again later." });
  };
}
