// src/middleware/10.session.ts
// ─────────────────────────────────────────────────────────────
// LAYER 10 — Session  (cookie parsing is built into koa-session)
//
// koa-session:
//   • Parses the session cookie automatically → no separate
//     cookie-parser package needed (satisfies requirement 11).
//   • Stores session data in Redis via a custom store adapter.
//   • Rotates the session ID on every write (rolling: true).
//   • Marks the cookie HttpOnly + Secure (prod) + SameSite=Lax.
//
// Session data is accessible via ctx.session in every route.
// Example:
//   ctx.session.userId  = user.id;   // set
//   const id = ctx.session.userId;   // read
//   ctx.session = null;              // destroy
// ─────────────────────────────────────────────────────────────

import session from "koa-session";
import type Koa from "koa";
import { randomUUID } from "node:crypto";
import { sessionRedis } from "../config/redis.ts";
import { config }       from "../config/index.ts";
import { logger }       from "../config/logger.ts";

// ── Redis session store adapter (koa-session store interface) ─
const redisStore = {
  // Read session from Redis
  async get(key: string, maxAge: number, { rolling }: { rolling: boolean }) {
    try {
      const raw = await sessionRedis.get(`${config.session.prefix}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      logger.error("Session GET error", { key, error: (e as Error).message });
      return null;
    }
  },

  // Write session to Redis with TTL
  async set(
    key:    string,
    sess:   Record<string, unknown>,
    maxAge: number,
    { rolling, changed }: { rolling: boolean; changed: boolean }
  ) {
    try {
      const ttl = Math.ceil(maxAge / 1000); // ms → seconds
      await sessionRedis.set(
        `${config.session.prefix}${key}`,
        JSON.stringify(sess),
        "EX",
        ttl
      );
    } catch (e) {
      logger.error("Session SET error", { key, error: (e as Error).message });
    }
  },

  // Delete session from Redis
  async destroy(key: string) {
    try {
      await sessionRedis.del(`${config.session.prefix}${key}`);
    } catch (e) {
      logger.error("Session DESTROY error", { key, error: (e as Error).message });
    }
  },
};

// ── Factory — returns the koa-session middleware ───────────────
export const sessionMiddleware = (app: Koa) => {
  // koa-session requires app.keys for cookie signing (HMAC-SHA256)
  app.keys = [config.session.key];

  return session(
    {
      // Cookie name
      key: "fleetflow.sid",

      // Session TTL in ms (matches JWT expiry by default: 8h)
      maxAge: config.session.maxAge,

      // Extend TTL on every request (keeps active users logged in)
      rolling: true,

      // Renew when session is < 50% of maxAge remaining
      renew: true,

      // Sign the cookie with app.keys (HMAC)
      signed: true,

      // Prevent client-side JS from reading the cookie
      httpOnly: true,

      // Only send over HTTPS in production
      secure: config.isProd,

      // Mitigate CSRF — Lax allows top-level navigation
      sameSite: "lax",

      // Use Redis store instead of the default cookie store
      store: redisStore,

      // Generate a unique session ID
      genid: () => randomUUID(),
    },
    app
  );
};
