// src/config/redis.ts
// ─────────────────────────────────────────────────────────────
// Shared ioredis clients.
// Two logical databases keep session keys and rate-limit
// counters cleanly separated.
// ─────────────────────────────────────────────────────────────

import { Redis } from "ioredis";
import { config } from "./index.ts";
import { logger }  from "./logger.ts";

const makeClient = (db: number, label: string) => {
  const client = new Redis(config.redis.url, {
    db,
    lazyConnect:       true,
    retryStrategy:     (times: number) => {
      if (times > 5) return null;
      return Math.min(times * 200, 3000);
    },
    enableReadyCheck:  true,
    maxRetriesPerRequest: 3,
  });

  client.on("connect",    () => logger.info(`Redis [${label}] connected`));
  client.on("error",      (e: Error) => logger.error(`Redis [${label}] error: ${e.message}`));
  client.on("reconnecting",() => logger.warn(`Redis [${label}] reconnecting…`));

  return client;
};

// Session store  (db 0)
export const sessionRedis   = makeClient(config.redis.sessionDb,   "session");

// Rate-limit store (db 1)
export const rateLimitRedis = makeClient(config.redis.ratelimitDb, "ratelimit");

// Connect both lazily at startup
export const connectRedis = async (): Promise<void> => {
  await Promise.all([sessionRedis.connect(), rateLimitRedis.connect()]);
};
