// src/middleware/01.errorHandler.ts
// ─────────────────────────────────────────────────────────────
// LAYER 1 — Error Handler  (outermost onion shell)
//
// • Must be registered FIRST so it wraps every inner layer.
// • Catches any thrown error from routes or inner middleware.
// • Emits structured JSON with a requestId for tracing.
// • Logs 5xx to Winston; 4xx are just warn-level.
// ─────────────────────────────────────────────────────────────

import type Koa from "koa";
import type { AppState } from "../types/index.ts";
import { logger } from "../config/logger.ts";
import { config } from "../config/index.ts";

// Named error class lets routes throw with a status code
export class AppError extends Error {
  constructor(
    public readonly status:  number,
    message:                 string,
    public readonly code?:   string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (): Koa.Middleware<AppState> => {
  return async (ctx, next) => {
    try {
      await next();

      // Unmatched route — no body was set
      if (ctx.status === 404 && !ctx.body) {
        ctx.status = 404;
        ctx.body = {
          success:   false,
          error: {
            code:      "NOT_FOUND",
            message:   `Cannot ${ctx.method} ${ctx.path}`,
            requestId: ctx.state.requestId,
          },
        };
      }
    } catch (err) {
      const e = err as Error & { status?: number; code?: string };

      const status  = e.status  ?? 500;
      const code    = e.code    ?? (status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR");
      const message = status < 500 ? e.message : "Internal Server Error";

      ctx.status = status;
      ctx.body   = {
        success: false,
        error: {
          code,
          message,
          requestId: ctx.state.requestId,
          ...(config.isDev && { stack: e.stack }),
        },
      };

      // Log with appropriate level
      const logPayload = {
        requestId: ctx.state.requestId,
        method:    ctx.method,
        path:      ctx.path,
        status,
        message:   e.message,
        stack:     e.stack,
      };

      if (status >= 500) logger.error("Unhandled error", logPayload);
      else               logger.warn("Client error",     logPayload);

      // Let Koa emit the 'error' event for any additional handlers
      ctx.app.emit("error", err, ctx);
    }
  };
};
