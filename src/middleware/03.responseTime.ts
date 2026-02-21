// src/middleware/03.responseTime.ts
// ─────────────────────────────────────────────────────────────
// LAYER 3 — Response Time
//
// • Records process.hrtime() before calling next().
// • After the response is ready, calculates elapsed ms.
// • Sets X-Response-Time header (e.g. "12.34ms").
// • Stores start time in ctx.state.startTime so the koa-logger
//   layer can re-use the same timestamp.
// ─────────────────────────────────────────────────────────────

import type Koa from "koa";
import type { AppState } from "../types/index.ts";

export const responseTime = (): Koa.Middleware<AppState> => {
  return async (ctx, next) => {
    const start = process.hrtime.bigint();
    ctx.state.startTime = Number(start);

    await next();

    const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000; // ns → ms
    ctx.set("X-Response-Time", `${elapsed.toFixed(2)}ms`);
  };
};
