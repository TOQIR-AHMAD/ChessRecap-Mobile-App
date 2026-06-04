import type { ImportResponse } from "./types";

/**
 * Server-side guards for the import route handlers: a short-lived response cache
 * (so repeated lookups don't hammer Chess.com / Lichess) and a per-client rate
 * limiter (so the endpoints can't be used as an open proxy).
 *
 * State is in-memory and per-instance. On a long-running Node server (`next
 * start`) it persists across requests; on serverless each warm instance keeps
 * its own copy — best-effort, but still cuts upstream load and casual abuse.
 * For multi-instance hardening, back these with Redis or similar.
 */

const CACHE_TTL_MS = 5 * 60_000; // recent-games lists barely change minute to minute
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; data: ImportResponse }>();

/** Return a cached response for `key`, or null if missing/expired. */
export function getCached(key: string): ImportResponse | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Touch for LRU ordering (Map preserves insertion order).
  cache.delete(key);
  cache.set(key, hit);
  return hit.data;
}

export function setCached(key: string, data: ImportResponse): void {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

const RATE_LIMIT = 30; // requests…
const RATE_WINDOW_MS = 60_000; // …per minute, per client
const hits = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window rate limit. `retryAfter` is seconds until the window resets. */
export function rateLimit(clientId: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = hits.get(clientId);

  if (!entry || now > entry.resetAt) {
    hits.set(clientId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    // Opportunistically drop expired entries so the map can't grow unbounded.
    if (hits.size > 5000) {
      for (const [id, e] of hits) if (now > e.resetAt) hits.delete(id);
    }
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  entry.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client identifier from proxy headers, for rate limiting. */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
