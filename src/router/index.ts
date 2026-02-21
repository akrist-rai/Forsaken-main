// src/router/index.ts
// ─────────────────────────────────────────────────────────────
// Router barrel — mounts every sub-router onto the Koa app.
//
// Each feature module owns its own Router instance with a
// scoped prefix.  This file simply collects them and provides
// a single mountRouters(app) function called from server.ts.
// ─────────────────────────────────────────────────────────────

import Router from "@koa/router";
import type Koa from "koa";

import vehicleRouter from "./vehicles.ts";
import driverRouter  from "./drivers.ts";
import tripRouter    from "./trips.ts";
import dispatchRouter from "./dispatch.ts";
import analyticsRouter from "./analytics.ts";
import expensesRouter from "./expenses.ts";

import { demoLogin, authRateLimit } from "../middleware/index.ts";

// ── Root / health router ──────────────────────────────────────
const rootRouter = new Router();

rootRouter.get("/health", (ctx) => {
  ctx.body = {
    success: true,
    data: {
      status:  "ok",
      service: "FleetFlow API",
      version: "1.0.0",
      time:    new Date().toISOString(),
      requestId: ctx.state.requestId,
    },
  };
});

// Auth — apply a stricter rate limit on the login route
rootRouter.post("/api/auth/login", authRateLimit(), demoLogin);

// ── Mount all sub-routers ─────────────────────────────────────
export function mountRouters(app: Koa): void {
  app.use(rootRouter.routes()).use(rootRouter.allowedMethods());
  app.use(vehicleRouter.routes()).use(vehicleRouter.allowedMethods());
  app.use(driverRouter.routes()).use(driverRouter.allowedMethods());
  app.use(tripRouter.routes()).use(tripRouter.allowedMethods());
  app.use(dispatchRouter.routes()).use(dispatchRouter.allowedMethods());
  app.use(analyticsRouter.routes()).use(analyticsRouter.allowedMethods());
  app.use(expensesRouter.routes()).use(expensesRouter.allowedMethods());
}
