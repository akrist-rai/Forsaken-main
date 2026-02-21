// src/middleware/05.httpLogger.ts
// ─────────────────────────────────────────────────────────────
// LAYER 5 — HTTP Request Logger  (koa-logger)
//
// koa-logger emits Apache-style lines:
//   --> GET /api/vehicles
//   <-- GET /api/vehicles 200 12ms 1.2kb
//
// The custom transporter pipes those lines into Winston so all
// output goes through a single logging pipeline.
// RequestId is injected into every line for correlation.
// ─────────────────────────────────────────────────────────────

import koaLogger from "koa-logger";
import type Koa  from "koa";
import type { AppState } from "../types/index.ts";
import { logger } from "../config/logger.ts";

export const httpLogger = (): Koa.Middleware<AppState> => {
  return koaLogger((str, args) => {
    // args[0] = method, args[1] = url, args[2] = status (on response)
    const isResponse = args.length >= 3;

    if (isResponse) {
      const status = Number(args[2]);
      if (status >= 500)      logger.error(str.trim());
      else if (status >= 400) logger.warn(str.trim());
      else                    logger.http(str.trim());
    } else {
      logger.http(str.trim());
    }
  }) as unknown as Koa.Middleware<AppState>;
};
