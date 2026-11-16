/**
 * Tiny in-memory fixed-window rate limiter (no dependencies).
 *
 * Limitation: state lives in this process only. On serverless / multi-instance
 * deployments each instance counts separately, so the effective limit is
 * higher. Swap `store` for Redis/Upstash if you need a hard global limit.
 */
type Entry = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as { __rateLimitStore?: Map<string, Entry> };
const store = (globalForLimiter.__rateLimitStore ??= new Map<string, Entry>());

const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (store.size < MAX_KEYS) return;
  store.forEach((entry, key) => {
    if (entry.resetAt <= now) store.delete(key);
  });
}

/** Count one hit for `key`. Returns whether it is still within `limit` for the current window. */
export function consume(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  sweep(now);
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, retryAfterMs: Math.max(entry.resetAt - now, 0) };
}

/** True when `key` has already used up `limit` hits in the current window (does not count a hit). */
export function isBlocked(key: string, limit: number) {
  const entry = store.get(key);
  return !!entry && entry.resetAt > Date.now() && entry.count >= limit;
}

export function resetLimit(key: string) {
  store.delete(key);
}

/** Best-effort client IP. Only trustworthy behind a proxy that sets these headers. */
export function clientIp(headers: Headers | Record<string, unknown> | undefined | null): string | null {
  if (!headers) return null;
  const get = (name: string): string | null => {
    if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name);
    const v = (headers as Record<string, unknown>)[name];
    return typeof v === "string" ? v : Array.isArray(v) ? String(v[0]) : null;
  };
  const forwarded = get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return get("x-real-ip");
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_IP_LIMIT = 30; // attempts per IP per window
export const LOGIN_EMAIL_LIMIT = 5; // failed attempts per email per window
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;
export const REGISTER_IP_LIMIT = 5; // sign-ups per IP per window
