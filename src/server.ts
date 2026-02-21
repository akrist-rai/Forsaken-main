// src/server.ts
// ─────────────────────────────────────────────────────────────
// FleetFlow — Application Entry Point
//
// Startup sequence:
//   1. Connect Redis  (session + rate-limit stores)
//   2. Apply middleware onion (13 layers)
//   3. Mount routers
//   4. Listen
// ─────────────────────────────────────────────────────────────

import Koa    from "koa";
import { config }         from "./config/index.ts";
import { logger }         from "./config/logger.ts";
import { connectRedis }   from "./config/redis.ts";
import { seedIfEmpty }    from "./db/seed.ts";
import { applyMiddleware }from "./middleware/index.ts";
import { mountRouters }   from "./router/index.ts";

const app = new Koa();

// Propagate Koa errors through Winston
app.on("error", (err, ctx) => {
  if (err.status && err.status < 500) return; // already logged as warn
  logger.error("Koa unhandled error", {
    message:   err.message,
    requestId: ctx?.state?.requestId,
    path:      ctx?.path,
  });
});

async function bootstrap() {
  // 1. Connect Redis
  try {
    await connectRedis();
  } catch (e) {
    logger.warn("Redis unavailable — session/ratelimit will degrade", {
      error: (e as Error).message,
    });
  }

  // 2. Middleware onion (order matters — see src/middleware/index.ts)
  applyMiddleware(app);

  // 3. Ensure demo baseline data in DB
  try {
    await seedIfEmpty();
  } catch (e) {
    logger.error("Database is not ready. Apply migrations before starting the API.", {
      error: (e as Error).message,
      hint: "Run: bun run db:push",
    });
    throw e;
  }

  // 4. Routers
  mountRouters(app);

  // 5. Start listening
  app.listen(config.port, "0.0.0.0", () => {
    logger.info(`
FleetFlow API server running on port ${config.port}

Middleware layers (onion order):
  01  errorHandler     — global catch-all
  02  requestId        — X-Request-ID tracking
  03  responseTime     — X-Response-Time header
  04  helmet           — security HTTP headers
  05  httpLogger       — koa-logger → Winston
  06  compress         — gzip / brotli
  07  cors             — cross-origin control
  08  bodyParser       — JSON + form parsing
  09  jsonPretty       — formatted responses
  10  session          — Redis-backed + cookie parsing
  11  security         — IP block, method guard, size limit
  12  rateLimit        — Redis sliding-window
  13  staticFiles      — serve /docs

API Routes:
  POST  /api/auth/login          (public, strict rate-limit)
  GET   /health                  (public)
  GET   /api/vehicles            (role-scoped)
  GET   /api/vehicles/kpis       (manager | finance)
  GET   /api/vehicles/in-shop    (manager)
  POST  /api/vehicles            (manager)
  POST  /api/vehicles/:id/maintenance
  PATCH /api/vehicles/:id/maintenance/:logId/complete
  GET   /api/drivers             (all roles)
  GET   /api/drivers/expiring-licences
  PATCH /api/drivers/:id
  GET   /api/trips
  POST  /api/trips
  POST  /api/trips/:id/dispatch
  POST  /api/trips/:id/complete
  POST  /api/trips/:id/cancel
  POST  /api/trips/:id/fuel-log
  GET   /api/dispatch/available
  GET   /api/analytics/dashboard
  GET   /api/analytics/finance
  GET   /api/expenses
`);
  });
}

bootstrap().catch((err) => {
  logger.error("Fatal startup error", { error: err.message, stack: err.stack });
  process.exit(1);
});

export default app;
