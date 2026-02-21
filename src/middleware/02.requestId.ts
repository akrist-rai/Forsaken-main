// src/middleware/02.requestId.ts
// ─────────────────────────────────────────────────────────────
// LAYER 2 — Request ID
//
// • Reads X-Request-ID from incoming headers (so a gateway or
//   client can pass its own correlation ID through).
// • Falls back to a generated UUID v4 if none is provided.
// • Writes the value back as X-Request-ID on the response so
//   clients can correlate logs.
// • Stores it in ctx.state.requestId for every downstream layer.
// ─────────────────────────────────────────────────────────────

import type Koa from "koa";
import { v4 as uuidv4 } from "uuid";
import type { AppState } from "../types/index.ts";

export const requestId = (): Koa.Middleware<AppState> => {
  return async (ctx, next) => {
    const id =
      (ctx.headers["x-request-id"] as string | undefined)?.trim() || uuidv4();

    ctx.state.requestId = id;
    ctx.set("X-Request-ID", id);          // echo back on response

    await next();
  };
};
