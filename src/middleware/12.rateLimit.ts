// src/middleware/12.rateLimit.ts
// ─────────────────────────────────────────────────────────────
// LAYER 12 — Rate Limiter  (Redis-backed sliding window)
//
// Uses the ioredis client (rateLimitRedis) to persist counters
// so limits are shared across all server instances in a cluster.
//
// Algorithm: fixed window per IP
//   Key  : ff:rl:<ip>
//   TTL  : windowMs / 1000 seconds
//
// Response headers set:
//   X-RateLimit-Limit      – max allowed requests
//   X-RateLimit-Remaining  – requests left in window
//   X-RateLimit-Reset      – UTC epoch seconds when window resets
//   Retry-After            – seconds to wait (only on 429)
//
// Two tiers:
//   default  – 120 req / 60 s  (all routes)
//   auth     – 10  req / 60 s  (login route only, brute-force guard)
// ─────────────────────────────────────────────────────────────

import type Koa   from "koa";
import type { AppState } from "../types/index.ts";
import { rateLimitRedis } from "../config/redis.ts";
import { config }         from "../config/index.ts";
import { AppError }       from "./01.errorHandler.ts";

interface RateLimitOptions {
  windowMs: number;   // window length in milliseconds
  max:      number;   // max requests per window
  keyPrefix?: string; // Redis key namespace
}

let rateLimitStoreHealthy = true;

// ── Core sliding-window counter using Redis INCR + EXPIRE ──────
const checkRateLimit = async (
  key:      string,
  windowMs: number,
  max:      number
): Promise<{ count: number; resetAt: number }> => {
  const windowSec = Math.ceil(windowMs / 1000);
  const now       = Math.floor(Date.now() / 1000);
  const resetAt   = now + windowSec;

  // INCR is atomic — safe for concurrent requests
  const count = await rateLimitRedis.incr(key);

  if (count === 1) {
    // First request in this window — set expiry
    await rateLimitRedis.expire(key, windowSec);
  }

  return { count, resetAt };
};

// ── Factory: returns a configurable rate-limit middleware ───────
export const rateLimit = (opts?: Partial<RateLimitOptions>): Koa.Middleware<AppState> => {
  const windowMs = opts?.windowMs ?? config.rateLimit.windowMs;
  const max      = opts?.max      ?? config.rateLimit.max;
  const prefix   = opts?.keyPrefix ?? config.rateLimit.prefix;

  return async (ctx, next) => {
    const ip  = ctx.ip ?? "unknown";
    const key = `${prefix}${ip}`;

    let count: number;
    let resetAt: number;
    try {
      ({ count, resetAt } = await checkRateLimit(key, windowMs, max));
      if (!rateLimitStoreHealthy) rateLimitStoreHealthy = true;
    } catch {
      // Fail-open if Redis is unavailable so core API stays available.
      rateLimitStoreHealthy = false;
      await next();
      return;
    }

    const remaining = Math.max(0, max - count);

    // Set informational headers on every request
    ctx.set("X-RateLimit-Limit",     String(max));
    ctx.set("X-RateLimit-Remaining", String(remaining));
    ctx.set("X-RateLimit-Reset",     String(resetAt));

    if (count > max) {
      const retryAfter = resetAt - Math.floor(Date.now() / 1000);
      ctx.set("Retry-After", String(retryAfter));
      throw new AppError(
        429,
        `Too many requests. Retry after ${retryAfter}s`,
        "RATE_LIMITED"
      );
    }

    await next();
  };
};

// ── Stricter limiter for auth endpoints (brute-force protection) ─
export const authRateLimit = () =>
  rateLimit({
    windowMs:  60_000,        // 1 minute
    max:       10,            // only 10 login attempts / minute
    keyPrefix: "ff:rl:auth:",
  });
