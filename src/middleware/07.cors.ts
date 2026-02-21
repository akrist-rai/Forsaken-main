// src/middleware/07.cors.ts
// ─────────────────────────────────────────────────────────────
// LAYER 7 — CORS  (Cross-Origin Resource Sharing)
//
// @koa/cors handles:
//   – Preflight  OPTIONS requests (responds with 204)
//   – Allowed origins (from ALLOWED_ORIGINS env, comma-separated)
//   – Exposed headers so clients can read X-Request-ID etc.
//   – credentials: true  →  cookies & auth headers forwarded
// ─────────────────────────────────────────────────────────────

import cors from "@koa/cors";
import { config } from "../config/index.ts";

export const corsMiddleware = () =>
  cors({
    // Origin whitelist — return the matched origin or block the request
    origin: (ctx) => {
      const incoming = ctx.request.headers.origin ?? "";
      return config.cors.origins.includes(incoming)
        ? incoming
        : config.cors.origins[0]; // fallback to first allowed origin
    },

    // Allow cookies / Authorization headers to be forwarded
    credentials: true,

    // HTTP methods the browser is allowed to use
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    // Headers clients are allowed to send
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Requested-With",
    ],

    // Headers exposed to JavaScript in the browser
    exposeHeaders: [
      "X-Request-ID",
      "X-Response-Time",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],

    // Cache preflight response for 24 hours
    maxAge: 86_400,
  });
